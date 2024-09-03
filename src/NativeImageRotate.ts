import type { TurboModule } from "react-native/Libraries/TurboModule/RCTExport";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  rotateImage(muri: string, mangle: number, success: (msuccess: string) => void, error: (merror: Object) => void):void;
}

export default TurboModuleRegistry.get<Spec>("ImageRotateNativeModule") as Spec;