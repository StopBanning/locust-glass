// locust-glass: macOS's own Liquid Glass behind an Electron window's page (macOS 26 and later).
//
// macOS 26 made NSGlassEffectView public: the material Finder, Messages and System Settings are drawn on. Electron
// has no option for it, so this small addon puts real ones behind the page: the window's whole ground, and any number
// of floating panels at rectangles the page measures (a sidebar, an inspector, a toolbar). The page lets them through
// wherever it paints nothing. The class is looked up by name and set by key, so this builds against an older SDK too
// and answers "not here" on a Mac without it.
//
// Written for Locust (https://locust.lol). MIT licensed.
#include <node_api.h>
#import <AppKit/AppKit.h>
#import <objc/runtime.h>

static const void *kGround = &kGround;
static const void *kPanels = &kPanels;
static const void *kBackdrop = &kBackdrop;

static NSView *rootOf(napi_env env, napi_value value) {
  void *data = nullptr;
  size_t length = 0;
  if (napi_get_buffer_info(env, value, &data, &length) != napi_ok || length < sizeof(void *)) return nil;
  return (__bridge NSView *)(*reinterpret_cast<void **>(data));
}

static bool has(napi_env env, napi_value object, const char *key) {
  bool out = false;
  napi_valuetype kind = napi_undefined;
  if (napi_typeof(env, object, &kind) != napi_ok || kind != napi_object) return false;
  return napi_has_named_property(env, object, key, &out) == napi_ok && out;
}

static double number(napi_env env, napi_value object, const char *key, double otherwise) {
  if (!has(env, object, key)) return otherwise;
  napi_value value;
  napi_get_named_property(env, object, key, &value);
  double out = otherwise;
  napi_get_value_double(env, value, &out);
  return out;
}

static NSString *text(napi_env env, napi_value value) {
  char buffer[512] = {0};
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, buffer, sizeof(buffer), &length) != napi_ok) return nil;
  return [NSString stringWithUTF8String:buffer];
}

static void onMain(dispatch_block_t block) {
  if ([NSThread isMainThread]) block();
  else dispatch_sync(dispatch_get_main_queue(), block);
}

// NSGlassEffectView.Style: 0 regular, 1 clear. Set by key, and only where the view takes it.
static void styleGlass(NSView *view, double radius, double style) {
  [view setValue:@(radius) forKey:@"cornerRadius"];
  if ([view respondsToSelector:NSSelectorFromString(@"setStyle:")]) {
    @try { [view setValue:@((NSInteger)style) forKey:@"style"]; } @catch (NSException *) {}
  }
}

static NSView *glassView(NSRect frame, double radius, double style) {
  Class glass = NSClassFromString(@"NSGlassEffectView");
  if (glass == nil) return nil;
  NSView *view = [[glass alloc] initWithFrame:frame];
  styleGlass(view, radius, style);
  return view;
}

// A rectangle measured from the window's top left, as the page measures it.
static NSRect frameFrom(NSView *root, double x, double y, double width, double height) {
  if (root.isFlipped) return NSMakeRect(x, y, width, height);
  return NSMakeRect(x, root.bounds.size.height - y - height, width, height);
}

static napi_value Supported(napi_env env, napi_callback_info) {
  napi_value out;
  napi_get_boolean(env, NSClassFromString(@"NSGlassEffectView") != nil, &out);
  return out;
}

// attach(handle, { style }) -> true when the window's ground is glass now.
static napi_value Attach(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  NSView *root = argc > 0 ? rootOf(env, argv[0]) : nil;
  double style = argc > 1 ? number(env, argv[1], "style", 0) : 0;
  __block bool attached = false;
  onMain(^{
    if (root == nil) return;
    NSView *ground = objc_getAssociatedObject(root, kGround);
    if (ground == nil) {
      ground = glassView(root.bounds, 0, style);
      if (ground == nil) return;
      ground.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
      NSView *picture = objc_getAssociatedObject(root, kBackdrop);
      if (picture != nil) [root addSubview:ground positioned:NSWindowAbove relativeTo:picture];
      else [root addSubview:ground positioned:NSWindowBelow relativeTo:nil];
      objc_setAssociatedObject(root, kGround, ground, OBJC_ASSOCIATION_RETAIN);
    } else {
      styleGlass(ground, 0, style);
    }
    attached = true;
  });
  napi_value out;
  napi_get_boolean(env, attached, &out);
  return out;
}

// panel(handle, id, { x, y, width, height, radius, style, followHeight } | null): a floating panel of glass over the
// ground, or none. With followHeight its height takes the window's as the window is resized, so a full-height sidebar
// only has to be sent when its width or place changes.
static napi_value Panel(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  NSView *root = argc > 0 ? rootOf(env, argv[0]) : nil;
  NSString *name = argc > 1 ? text(env, argv[1]) : nil;
  bool none = argc < 3 || !has(env, argv[2], "width");
  double x = none ? 0 : number(env, argv[2], "x", 0), y = none ? 0 : number(env, argv[2], "y", 0);
  double width = none ? 0 : number(env, argv[2], "width", 0), height = none ? 0 : number(env, argv[2], "height", 0);
  double radius = none ? 0 : number(env, argv[2], "radius", 0), style = none ? 0 : number(env, argv[2], "style", 0);
  bool follow = !none && number(env, argv[2], "followHeight", 0) != 0;
  onMain(^{
    if (root == nil || name == nil) return;
    NSView *ground = objc_getAssociatedObject(root, kGround);
    NSMutableDictionary<NSString *, NSView *> *panels = objc_getAssociatedObject(root, kPanels);
    if (panels == nil) {
      panels = [NSMutableDictionary dictionary];
      objc_setAssociatedObject(root, kPanels, panels, OBJC_ASSOCIATION_RETAIN);
    }
    NSView *panel = panels[name];
    if (none || ground == nil || width <= 0 || height <= 0) {
      panel.hidden = YES;
      return;
    }
    if (panel == nil) {
      panel = glassView(NSZeroRect, radius, style);
      if (panel == nil) return;
      [root addSubview:panel positioned:NSWindowAbove relativeTo:ground];
      panels[name] = panel;
    }
    styleGlass(panel, radius, style);
    panel.autoresizingMask = follow ? NSViewHeightSizable : (root.isFlipped ? NSViewMaxYMargin : NSViewMinYMargin);
    panel.frame = frameFrom(root, x, y, width, height);
    panel.hidden = NO;
  });
  return nullptr;
}

// backdrop(handle, path): a picture under the glass, inside the window. For screenshots and tests: the glass then
// shows a known desktop, and a capture of this one window shows it with nobody's own windows in the frame.
static napi_value Backdrop(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  NSView *root = argc > 0 ? rootOf(env, argv[0]) : nil;
  NSString *file = argc > 1 ? text(env, argv[1]) : nil;
  onMain(^{
    if (root == nil || file.length == 0) return;
    NSImage *image = [[NSImage alloc] initWithContentsOfFile:file];
    if (image == nil) return;
    NSImageView *picture = [[NSImageView alloc] initWithFrame:root.bounds];
    picture.image = image;
    picture.imageScaling = NSImageScaleAxesIndependently;
    picture.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    [objc_getAssociatedObject(root, kBackdrop) removeFromSuperview];
    [root addSubview:picture positioned:NSWindowBelow relativeTo:nil];
    objc_setAssociatedObject(root, kBackdrop, picture, OBJC_ASSOCIATION_RETAIN);
  });
  return nullptr;
}

// detach(handle): the window goes back to what it was made with.
static napi_value Detach(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  NSView *root = argc > 0 ? rootOf(env, argv[0]) : nil;
  onMain(^{
    if (root == nil) return;
    NSMutableDictionary<NSString *, NSView *> *panels = objc_getAssociatedObject(root, kPanels);
    for (NSView *panel in panels.allValues) [panel removeFromSuperview];
    objc_setAssociatedObject(root, kPanels, nil, OBJC_ASSOCIATION_RETAIN);
    const void *keys[] = {kGround, kBackdrop};
    for (const void *key : keys) {
      [objc_getAssociatedObject(root, key) removeFromSuperview];
      objc_setAssociatedObject(root, key, nil, OBJC_ASSOCIATION_RETAIN);
    }
  });
  return nullptr;
}

static napi_value Init(napi_env env, napi_value exports) {
  const napi_property_descriptor methods[] = {
    {"supported", nullptr, Supported, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"attach", nullptr, Attach, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"panel", nullptr, Panel, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"backdrop", nullptr, Backdrop, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"detach", nullptr, Detach, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
