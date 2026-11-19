export const projectionTilt = 0.7;
export const referenceCamera = { widthPx: 1280, heightPx: 800, zoom: 1.22 };
export const screensPerSide = 100;
export const mapSize = {
    width: (screensPerSide * referenceCamera.widthPx) / referenceCamera.zoom,
    height: (screensPerSide * referenceCamera.heightPx) / (referenceCamera.zoom * projectionTilt),
};
export const regions = {
    meadow: { x: -mapSize.width * 0.29, y: mapSize.height * 0.22, name: '외곽 채굴터' },
    boss: { x: 0, y: 0, name: '맵 정중앙' },
};
