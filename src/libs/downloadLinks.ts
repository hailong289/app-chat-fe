export type DownloadLinks = {
  desktopWindows: string | null;
  desktopMacos: string | null;
  desktopLinux: string | null;
  androidStore: string | null;
  iosStore: string | null;
};

export function getDownloadLinks(): DownloadLinks {
  return {
    desktopWindows: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_WINDOWS?.trim() || null,
    desktopMacos: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_MACOS?.trim() || null,
    desktopLinux: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX?.trim() || null,
    androidStore: process.env.NEXT_PUBLIC_ANDROID_STORE_URL?.trim() || null,
    iosStore: process.env.NEXT_PUBLIC_IOS_STORE_URL?.trim() || null,
  };
}

export function hasAnyDesktopDownload(links: DownloadLinks): boolean {
  return !!(links.desktopWindows || links.desktopMacos || links.desktopLinux);
}

export function hasAnyMobileDownload(links: DownloadLinks): boolean {
  return !!(links.androidStore || links.iosStore);
}
