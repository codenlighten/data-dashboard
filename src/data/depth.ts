export type DepthClass = "shallow" | "mid" | "deep";

/** Standard seismology depth bands: shallow < 70 km, intermediate 70 to 300 km, deep beyond. */
export const depthClass = (km: number): DepthClass => (km < 70 ? "shallow" : km < 300 ? "mid" : "deep");
