import { registerPlugin } from "@capacitor/core";

import type { LocationTrackingPlugin } from "./definitions";

const LocationTracking = registerPlugin<LocationTrackingPlugin>("LocationTracking", {
  web: () => import("./web").then((m) => new m.LocationTrackingWeb()),
});

export * from "./definitions";
export { LocationTracking };
