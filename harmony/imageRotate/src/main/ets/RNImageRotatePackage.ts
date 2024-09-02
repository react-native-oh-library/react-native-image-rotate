import {
    RNPackage,
    TurboModulesFactory,
  } from "@rnoh/react-native-openharmony/ts";
  import type {
    TurboModule,
    TurboModuleContext,
  } from "@rnoh/react-native-openharmony/ts";
  import { TM } from "@rnoh/react-native-openharmony/generated/ts";
  import { RNImageRotateTurboModule } from "./RNImageRotateTurboModule";
  
  class ImageRotateModulesFactory extends TurboModulesFactory {
    createTurboModule(name: string): TurboModule | null {
      if (name === TM.ImageRotateNativeModule.NAME) {
        return new RNImageRotateTurboModule(this.ctx);
      }
      return null;
    }
  
    hasTurboModule(name: string): boolean {
      return name === TM.ImageRotateNativeModule.NAME;
    }
  }
  
  export class RNImageRotatePackage extends RNPackage {
    createTurboModulesFactory(ctx: TurboModuleContext): TurboModulesFactory {
      return new ImageRotateModulesFactory(ctx);
    }
  }