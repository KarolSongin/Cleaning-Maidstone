export const photoQuality = 90;

const aspectRatios: Record<string, number> = {
  "/images/living-room.webp": 4 / 3,
  "/images/home-detail.webp": 3 / 2,
  "/images/kitchen-detail.webp": 3 / 2,
  "/images/bathroom-detail.webp": 3600 / 2403,
};

// A cover image must have enough pixels for both the panel's width and height.
// Portrait crops of landscape sources need a wider file than the visible panel.
export function heroPhotoSizes(src: string) {
  const ratio = aspectRatios[src] || 3 / 2;
  return [
    `(max-width: 760px) max(calc(100vw - 74px), ${Math.ceil(360 * ratio)}px)`,
    `(max-width: 1100px) max(calc(52.5vw - 71px), ${Math.ceil(510 * ratio)}px)`,
    `(max-width: 1440px) max(calc(52.5vw - 92px), ${Math.ceil(548 * ratio)}px)`,
    `(min-width: 1500px) ${Math.ceil(590 * ratio)}px`,
    `${Math.ceil(548 * ratio)}px`,
  ].join(", ");
}

export const carePhotoSizes = [
  "(max-width: 760px) max(calc(100vw - 50px), 540px)",
  "(max-width: 1100px) 1050px",
  "968px",
].join(", ");

export function pagePhotoSizes(src: string, aside = false) {
  const ratio = aspectRatios[src] || 3 / 2;
  const height = aside ? 405 : 580;
  const mobileHeight = aside ? 350 : 370;
  return [
    `(max-width: 760px) max(calc(100vw - 50px), ${Math.ceil(mobileHeight * ratio)}px)`,
    `(max-width: 1280px) max(calc(50vw - 84px), ${Math.ceil(height * ratio)}px)`,
    `max(556px, ${Math.ceil(height * ratio)}px)`,
  ].join(", ");
}

export const journalPhotoSizes = [
  "(max-width: 760px) max(calc(100vw - 50px), 315px)",
  "(max-width: 1280px) max(calc(33.333vw - 49px), 315px)",
  "378px",
].join(", ");
