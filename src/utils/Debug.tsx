import GUI from "lil-gui";

export class Debug {
  private static instance: Debug | null = null;

  public readonly active: boolean;
  private readonly gui: GUI | null;
  private readonly folders = new Map<string, GUI>();

  static getInstance(): Debug {
    if (!Debug.instance) {
      Debug.instance = new Debug();
    }
    return Debug.instance;
  }

  private constructor() {
    this.active = new URLSearchParams(window.location.search).has("debug");
    if (this.active) {
      this.gui = new GUI({ title: 'La-Fabrik Debug' });
    } else {
      this.gui = null;
    }
  }

  createFolder(name: string): GUI | null {
    if (!this.gui) {
      return null;
    }

    const existingFolder = this.folders.get(name);

    if (existingFolder) {
      return existingFolder;
    }

    const folder = this.gui.addFolder(name);
    this.folders.set(name, folder);

    return folder;
  }

  destroy(): void {
    this.folders.clear();
    this.gui?.destroy();
    Debug.instance = null;
  }
}