
import { TurboModule, TurboModuleContext} from '@rnoh/react-native-openharmony/ts';
import { TM } from "@rnoh/react-native-openharmony/generated/ts"
import { BusinessError } from '@ohos.base';
import { common } from '@kit.AbilityKit';
import image from '@ohos.multimedia.image';
import fs from '@ohos.file.fs';
import http from '@ohos.net.http'
import util from '@ohos.util';

export class RNImageRotateTurboModule extends TurboModule implements TM.ImageRotateNativeModule.Spec {

    private static TEMP_FILE_PREFIX: string  = "ReactNative_rotated_image_";
    private static COMPRESS_QUALITY: number = 90;
    constructor(protected ctx: TurboModuleContext) {
        super(ctx);
        const mcontext = this.ctx.uiAbilityContext;
        let cleanTask = new RNImageRotateTurboModule.CleanTask(mcontext);
        cleanTask.cleanDirectory();
    }

     rotateImage(muri: string, mangle: number, success: (msuccess: string) => void, error: (merror: Object) => void) {
        if (muri === null || muri === "") {
            throw new Error("Please specify a URI");
        }
         const mcontext = this.ctx.uiAbilityContext;
         let cleanTask = new RNImageRotateTurboModule.CleanTask(mcontext);
         cleanTask.cleanDirectory();

         let rotateTask = new RNImageRotateTurboModule.RotateTask(
            mcontext,
            muri,
            mangle,
            success,
            error);
        rotateTask.openBitmapInputStream(rotateTask.mUri).then((imagePixelMap)=>{
            imagePixelMap.rotate(rotateTask.mAngle).then(() => {
                rotateTask.doInBackgroundGuarded(imagePixelMap);
            }).catch((err: BusinessError) => {
                console.error(`Failed to rotate pixelmap. code is ${err.code}, message is ${err.message}`);
            });
        });
    }

     static CleanTask = class zCleanTask {
        mContext: common.UIAbilityContext
        constructor(mcontext: common.UIAbilityContext){
            this.mContext = mcontext;
        }
        cleanDirectory() {
            let options = {
                recursion: false,
                listNum: 0,
                filter: {
                    'suffix': ['.png', '.jpg', '.webp'],
                    "displayName": ["ReactNative_rotated_image_*"],
                }
            };
            let pathDir = this.mContext.cacheDir;
            fs.listFile(pathDir, options).then((filenames)=>{
                for (let i = 0; i < filenames.length; i++) {
                    let src = pathDir + '/' + filenames[i];
                    fs.unlinkSync(src);
                    console.info("CleanTask filename: %s", filenames[i]);
                    console.info("CleanTask filename: %s", src);
                }
            }).catch((err) => {
                console.error("list file failed with error message: " + err.message + ", error code: " + err.code);
            });
        }
    }

    private static RotateTask = class zRotateTask {
        private imageType: string = 'image/png';
        mContext: common.UIAbilityContext
        mUri: string
        mAngle: number
        mSuccess: (msuccess: string) => void
        mError: (merror: Object) => void
        constructor(mcontext: common.UIAbilityContext, muri: string, mangle: number, success: (uri: string) => void, error: (merror: Object) => void) {
            this.mContext = mcontext;
            this.mUri = muri;
            this.mAngle = mangle;
            this.mSuccess = success;
            this.mError = error;
        }


        // 网络图片转换为PixelMap
        private async getPixelMapFromURL(src: string): Promise<image.PixelMap> {
            const data: http.HttpResponse = await http.createHttp().request(src);
            if (data.responseCode === http.ResponseCode.OK && data.result instanceof ArrayBuffer) {
                if (data.header.hasOwnProperty('content-type')) {
                    this.imageType = data.header['content-type'];
                }
                let imageData: ArrayBuffer = data.result;
                const imageSource: image.ImageSource = image.createImageSource(imageData);
                const imageInfo = await imageSource.getImageInfo();
                const imageWidth = Math.round(imageInfo.size.width);
                const imageHeight = Math.round(imageInfo.size.height);
                const option: image.InitializationOptions = {
                    'alphaType': 0,
                    'editable': false,
                    'pixelFormat': 3,
                    'scaleMode': 1,
                    'size': { height: imageHeight, width: imageWidth },
                }
                let pixelMap: image.PixelMap = await imageSource.createPixelMap(option);
                return pixelMap;
            }
        }

        // 本地图片uri转pixelMap
        // src对应的是本地图片的协议url
        private async getPixelMapFromFile(src: string): Promise<image.PixelMap> {
            let file = fs.openSync(src, fs.OpenMode.READ_WRITE);
            try {
                const imageSource = image.createImageSource(file.fd);
                const imagePackApi = image.createImagePacker();
                const imageInfo = await imageSource.getImageInfo();
                this.imageType = imageInfo.mimeType;
                if (!['image/png', 'image/jpeg', 'image/webp'].includes(this.imageType)) {
                    this.imageType = 'image/png';
                }
                const packOpts: image.PackingOption = {
                    format: `${this.imageType}`,
                    quality: 100,
                }
                let readBuffer = await imagePackApi.packing(imageSource, packOpts);
                const imageSourceFromBuffer: image.ImageSource = image.createImageSource(readBuffer as ArrayBuffer);
                const imageWidth = Math.round(imageInfo.size.width);
                const imageHeight = Math.round(imageInfo.size.height);
                const option: image.InitializationOptions = {
                    'alphaType': 0,
                    'editable': false,
                    'pixelFormat': 3,
                    'scaleMode': 1,
                    'size': { height: imageHeight, width: imageWidth },
                }
                return await imageSourceFromBuffer.createPixelMap(option);
            } catch (err) {
                console.error("getPixelMapFromFile failed with error message: " + err.message + ", error code: " + err.code);
            } finally {
                fs.closeSync(file);
            }
        }

        async openBitmapInputStream(muri:string): Promise<image.PixelMap> {
            let imagePixelMap: image.PixelMap | undefined = undefined;
              if (muri.includes('http')) {
                // online picture to pixelMap
                imagePixelMap = await this.getPixelMapFromURL(muri);
              } else {
                imagePixelMap = await this.getPixelMapFromFile(muri);
              }
              if (imagePixelMap === undefined) {
                console.info('Error Bad uri, Failed to decode PixelMap: uri ' + muri);
              }
              return imagePixelMap;
        }

        async doInBackgroundGuarded(imagePixelMap:image.PixelMap) {
            try {
                let type = imagePixelMap.getImageInfoSync().mimeType;
                let typetemp = this.getFileExtensionForType(type);
                let src = this.getCacheFilePath(typetemp);
                let tempFile = fs.openSync(src, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE);
                const imagePackerApi: image.ImagePacker = image.createImagePacker();
                const buf = await imagePackerApi.packing(imagePixelMap, {format: type, quality: RNImageRotateTurboModule.COMPRESS_QUALITY});
                await fs.write(tempFile.fd, buf);
                this.mSuccess(src);
                fs.closeSync(tempFile.fd);
            } catch (err) {
                console.info("生成路径失败 "+ err.message);
                this.mError(err.message);
            }
        }

        private getCacheFilePath(type: string):string {
            return 'file://' + this.mContext.cacheDir + "/" + RNImageRotateTurboModule.TEMP_FILE_PREFIX + util.generateRandomUUID(true) + type;
        }

        private getFileExtensionForType(mimeType: string): string {
            if (mimeType === "image/png") {
                return ".png";
            }
            if (mimeType === "image/webp") {
                return ".webp";
            }
            return ".jpg";
        }
    }
}