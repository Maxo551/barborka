const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const LEVELS = [
  {
    key: "quiet-street",
    name: "Quiet Street",
    shots: 3,
    requiredPhotos: 1,
    background: {
      palette: ["#2a2f3b", "#39495c", "#5d6c7f", "#b48c73"],
    },
    platforms: [
      { x: 480, y: 500, width: 900, height: 40 },
      { x: 150, y: 380, width: 180, height: 24 },
      { x: 720, y: 340, width: 200, height: 24 },
    ],
    photoSpots: [
      { id: "street-lamp", x: 260, y: 330 },
      { id: "window", x: 720, y: 290 },
    ],
    vinyls: [
      { id: "fontaines", x: 880, y: 450, requiresPhoto: "street-lamp" },
    ],
    exit: { x: 900, y: 440 },
    props: {
      lamps: [{ x: 300, y: 410 }],
      cafe: { x: 680, y: 420 },
      recordShop: { x: 140, y: 420 },
    },
  },
  {
    key: "graffiti-alley",
    name: "Graffiti Alley",
    shots: 4,
    requiredPhotos: 2,
    requiredVinyls: 1,
    background: {
      palette: ["#1f1f28", "#3b3241", "#6c5e6f", "#b0926a"],
    },
    platforms: [
      { x: 480, y: 500, width: 880, height: 40 },
      { x: 250, y: 390, width: 200, height: 24 },
      { x: 520, y: 320, width: 160, height: 24 },
      { x: 780, y: 260, width: 160, height: 24 },
    ],
    movingCrates: [
      { x: 420, y: 460, range: 120, speed: 30 },
    ],
    photoSpots: [
      { id: "mural", x: 260, y: 340 },
      { id: "poster", x: 520, y: 270 },
      { id: "sticker", x: 780, y: 210 },
    ],
    vinyls: [
      { id: "dean", x: 540, y: 280 },
      { id: "brockhampton", x: 820, y: 210, requiresPhoto: "sticker" },
    ],
    exit: { x: 900, y: 440 },
    props: {
      graffiti: [
        { x: 140, y: 320 },
        { x: 340, y: 280 },
        { x: 640, y: 220 },
      ],
    },
  },
  {
    key: "subway-entrance",
    name: "Subway Entrance",
    shots: 4,
    requiredPhotos: 1,
    background: {
      palette: ["#1b262f", "#32444f", "#5a6c73", "#b1a58d"],
    },
    platforms: [
      { x: 480, y: 500, width: 880, height: 40 },
      { x: 180, y: 360, width: 180, height: 24 },
      { x: 420, y: 300, width: 160, height: 24 },
      { x: 700, y: 260, width: 180, height: 24 },
      { x: 860, y: 180, width: 120, height: 24 },
    ],
    photoSpots: [
      { id: "ubahn", x: 160, y: 310 },
      { id: "platform", x: 700, y: 210 },
    ],
    vinyls: [
      { id: "kingkrule", x: 860, y: 140 },
    ],
    exit: { x: 920, y: 440 },
    props: {
      ubahn: { x: 160, y: 420 },
      lights: [
        { x: 600, y: 160 },
        { x: 820, y: 120 },
      ],
    },
  },
  {
    key: "bridge-night",
    name: "Bridge at Night",
    shots: 4,
    requiredPhotos: 1,
    background: {
      palette: ["#141824", "#2b3646", "#42556b", "#9a8c7a"],
    },
    platforms: [
      { x: 480, y: 460, width: 920, height: 40 },
      { x: 300, y: 320, width: 220, height: 24 },
      { x: 680, y: 300, width: 220, height: 24 },
      { x: 480, y: 200, width: 180, height: 24 },
      { x: 140, y: 520, width: 200, height: 24 },
    ],
    wind: true,
    photoSpots: [
      { id: "river", x: 480, y: 260 },
    ],
    vinyls: [
      { id: "savagemode", x: 120, y: 520, hidden: true },
    ],
    exit: { x: 900, y: 400 },
    props: {
      bridge: { x: 480, y: 380 },
      lamps: [{ x: 220, y: 330 }, { x: 740, y: 330 }],
    },
  },
  {
    key: "rooftop",
    name: "Rooftop",
    shots: 3,
    requiredPhotos: 1,
    background: {
      palette: ["#0e111a", "#293244", "#4b5c78", "#b6a792"],
    },
    platforms: [
      { x: 480, y: 480, width: 920, height: 40 },
      { x: 240, y: 360, width: 180, height: 24 },
      { x: 640, y: 320, width: 200, height: 24 },
      { x: 820, y: 220, width: 160, height: 24 },
    ],
    photoSpots: [
      { id: "skyline", x: 820, y: 170 },
    ],
    vinyls: [
      { id: "radiohead", x: 120, y: 430, requiresPhoto: "skyline" },
    ],
    exit: { x: 920, y: 420 },
    props: {
      tower: { x: 760, y: 140 },
      antennas: [{ x: 320, y: 260 }],
    },
  },
];

const VINYL_ALBUMS = {
  fontaines: {
    name: "Fontaines D.C.",
    palette: ["#f1d07a", "#3b1e0a", "#ad3d2a", "#1e1208"],
  },
  dean: {
    name: "Dean Blunt",
    palette: ["#c9c7bb", "#2b2a27", "#6f695e", "#a84b3b"],
  },
  brockhampton: {
    name: "Brockhampton",
    palette: ["#f2f2f2", "#1a1a1a", "#8a8a8a", "#d94b4b"],
  },
  kingkrule: {
    name: "King Krule",
    palette: ["#17212b", "#28465b", "#2f87a0", "#f1d7b5"],
  },
  savagemode: {
    name: "Savage Mode II",
    palette: ["#0b0b0b", "#3c2f2f", "#b33a3a", "#f4c8c8"],
  },
  radiohead: {
    name: "Radiohead",
    palette: ["#dae2e6", "#2b2f3a", "#627a7d", "#f2a35e"],
  },
};

const SAVE_KEY = "barbora_save";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload() {
    this.createTextures();
  }

  create() {
    this.scene.start("menu");
  }

  createTextures() {
    this.createPlayerTextures();
    this.createUiTextures();
    this.createVinylTextures();
    this.createEnvironmentTextures();
    this.createMenuBackground();
  }

  createPlayerTextures() {
    const frames = [
      { key: "player_idle", hairOffset: 0, strapOffset: 0, legOffset: 0 },
      { key: "player_walk1", hairOffset: 1, strapOffset: 1, legOffset: 1 },
      { key: "player_walk2", hairOffset: -1, strapOffset: -1, legOffset: -1 },
      { key: "player_jump", hairOffset: 0, strapOffset: 0, legOffset: -2 },
    ];

    frames.forEach((frame) => {
      const canvas = this.textures.createCanvas(frame.key, 24, 32);
      const ctx = canvas.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 24, 32);

      // Hair
      ctx.fillStyle = "#1b1b1b";
      ctx.fillRect(5, 2 + frame.hairOffset, 14, 10);
      ctx.fillRect(4, 4 + frame.hairOffset, 16, 8);

      // Face
      ctx.fillStyle = "#c18b6a";
      ctx.fillRect(7, 10 + frame.hairOffset, 10, 8);

      // Top (white turtleneck)
      ctx.fillStyle = "#f1f1f1";
      ctx.fillRect(6, 18, 12, 6);
      ctx.fillRect(8, 16, 8, 2);

      // Camera strap
      ctx.fillStyle = "#4b3e36";
      ctx.fillRect(7, 18 + frame.strapOffset, 2, 6);
      ctx.fillRect(15, 18 + frame.strapOffset, 2, 6);

      // Camera body
      ctx.fillStyle = "#5b4b43";
      ctx.fillRect(9, 22, 6, 4);
      ctx.fillStyle = "#9aa3a6";
      ctx.fillRect(11, 23, 2, 2);

      // Pants
      ctx.fillStyle = "#202026";
      ctx.fillRect(6, 24, 12, 6);

      // Legs
      ctx.fillStyle = "#1b1b1b";
      ctx.fillRect(6, 30 + frame.legOffset, 4, 2);
      ctx.fillRect(14, 30 + frame.legOffset, 4, 2);

      // Shoes
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(5, 31 + frame.legOffset, 6, 1);
      ctx.fillRect(13, 31 + frame.legOffset, 6, 1);
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(6, 31 + frame.legOffset, 2, 1);
      ctx.fillRect(14, 31 + frame.legOffset, 2, 1);

      canvas.refresh();
    });
  }

  createUiTextures() {
    const cameraCanvas = this.textures.createCanvas("camera_icon", 16, 16);
    const ctx = cameraCanvas.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#423a36";
    ctx.fillRect(1, 5, 14, 9);
    ctx.fillRect(4, 3, 8, 2);
    ctx.fillStyle = "#b9b5ae";
    ctx.fillRect(6, 7, 4, 4);
    ctx.fillStyle = "#6d5f58";
    ctx.fillRect(2, 6, 3, 2);
    cameraCanvas.refresh();

    const photoCanvas = this.textures.createCanvas("photo_icon", 16, 16);
    const photoCtx = photoCanvas.getContext();
    photoCtx.imageSmoothingEnabled = false;
    photoCtx.fillStyle = "#f2efe9";
    photoCtx.fillRect(2, 2, 12, 12);
    photoCtx.fillStyle = "#c1b7a6";
    photoCtx.fillRect(4, 4, 8, 6);
    photoCtx.fillStyle = "#9ba2a8";
    photoCtx.fillRect(4, 10, 8, 2);
    photoCanvas.refresh();

    const glowCanvas = this.textures.createCanvas("photo_glow", 32, 32);
    const glowCtx = glowCanvas.getContext();
    glowCtx.imageSmoothingEnabled = false;
    glowCtx.fillStyle = "rgba(255, 244, 200, 0.25)";
    glowCtx.beginPath();
    glowCtx.arc(16, 16, 14, 0, Math.PI * 2);
    glowCtx.fill();
    glowCtx.strokeStyle = "rgba(255, 244, 200, 0.8)";
    glowCtx.strokeRect(6, 6, 20, 20);
    glowCanvas.refresh();

    const exitCanvas = this.textures.createCanvas("exit_door", 24, 40);
    const exitCtx = exitCanvas.getContext();
    exitCtx.imageSmoothingEnabled = false;
    exitCtx.fillStyle = "#2b2b34";
    exitCtx.fillRect(2, 6, 20, 32);
    exitCtx.fillStyle = "#454c5f";
    exitCtx.fillRect(4, 8, 16, 28);
    exitCtx.fillStyle = "#b7a08a";
    exitCtx.fillRect(16, 20, 3, 2);
    exitCanvas.refresh();

    const frameCanvas = this.textures.createCanvas("photo_frame", 32, 32);
    const frameCtx = frameCanvas.getContext();
    frameCtx.imageSmoothingEnabled = false;
    frameCtx.strokeStyle = "rgba(255, 244, 200, 0.9)";
    frameCtx.strokeRect(4, 4, 24, 24);
    frameCtx.strokeRect(6, 6, 20, 20);
    frameCanvas.refresh();
  }

  createVinylTextures() {
    Object.entries(VINYL_ALBUMS).forEach(([key, album]) => {
      const canvas = this.textures.createCanvas(`vinyl_${key}`, 20, 20);
      const ctx = canvas.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 20, 20);

      ctx.fillStyle = "#101014";
      ctx.beginPath();
      ctx.arc(10, 10, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#2a2b36";
      ctx.beginPath();
      ctx.arc(10, 10, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(4, 4);
      this.drawAlbumCover(ctx, key);
      ctx.restore();

      ctx.fillStyle = "#f5f1ea";
      ctx.fillRect(9, 9, 2, 2);

      canvas.refresh();
    });
  }

  drawAlbumCover(ctx, key) {
    ctx.fillStyle = "#f1efe9";
    ctx.fillRect(0, 0, 12, 12);

    if (key === "fontaines") {
      ctx.fillStyle = "#f1d07a";
      ctx.fillRect(0, 0, 12, 12);
      ctx.fillStyle = "#ad3d2a";
      ctx.fillRect(0, 6, 12, 4);
      ctx.fillStyle = "#3b1e0a";
      ctx.fillRect(2, 2, 3, 3);
      ctx.fillRect(7, 2, 3, 3);
    } else if (key === "dean") {
      ctx.fillStyle = "#c9c7bb";
      ctx.fillRect(0, 0, 12, 12);
      ctx.fillStyle = "#2b2a27";
      ctx.fillRect(1, 1, 5, 10);
      ctx.fillRect(7, 2, 4, 3);
      ctx.fillStyle = "#a84b3b";
      ctx.fillRect(7, 7, 3, 3);
    } else if (key === "brockhampton") {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(0, 0, 12, 12);
      ctx.fillStyle = "#d94b4b";
      ctx.fillRect(0, 6, 12, 6);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(3, 2, 6, 4);
      ctx.fillRect(4, 6, 4, 3);
    } else if (key === "kingkrule") {
      ctx.fillStyle = "#17212b";
      ctx.fillRect(0, 0, 12, 12);
      ctx.fillStyle = "#2f87a0";
      ctx.fillRect(0, 4, 12, 4);
      ctx.fillStyle = "#f1d7b5";
      ctx.fillRect(2, 2, 4, 3);
      ctx.fillStyle = "#28465b";
      ctx.fillRect(7, 7, 4, 3);
    } else if (key === "savagemode") {
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, 12, 12);
      ctx.fillStyle = "#b33a3a";
      ctx.fillRect(0, 7, 12, 5);
      ctx.fillStyle = "#f4c8c8";
      ctx.fillRect(2, 2, 3, 3);
      ctx.fillRect(7, 2, 3, 3);
      ctx.fillStyle = "#3c2f2f";
      ctx.fillRect(5, 6, 2, 2);
    } else if (key === "radiohead") {
      ctx.fillStyle = "#dae2e6";
      ctx.fillRect(0, 0, 12, 12);
      ctx.fillStyle = "#627a7d";
      ctx.fillRect(0, 7, 12, 2);
      ctx.fillStyle = "#2b2f3a";
      ctx.fillRect(2, 5, 3, 3);
      ctx.fillRect(7, 4, 3, 4);
      ctx.fillStyle = "#f2a35e";
      ctx.fillRect(1, 1, 2, 2);
    }
  }

  createEnvironmentTextures() {
    const platformCanvas = this.textures.createCanvas("platform", 120, 20);
    const ctx = platformCanvas.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3b3f4e";
    ctx.fillRect(0, 0, 120, 20);
    ctx.fillStyle = "#4d5366";
    ctx.fillRect(0, 0, 120, 6);
    ctx.fillStyle = "#2a2d39";
    ctx.fillRect(0, 14, 120, 6);
    platformCanvas.refresh();

    const crateCanvas = this.textures.createCanvas("crate", 24, 24);
    const crateCtx = crateCanvas.getContext();
    crateCtx.imageSmoothingEnabled = false;
    crateCtx.fillStyle = "#5b4537";
    crateCtx.fillRect(0, 0, 24, 24);
    crateCtx.fillStyle = "#7a5b43";
    crateCtx.fillRect(2, 2, 20, 20);
    crateCtx.fillStyle = "#3b2b22";
    crateCtx.fillRect(2, 10, 20, 4);
    crateCtx.fillRect(10, 2, 4, 20);
    crateCanvas.refresh();

    const lampCanvas = this.textures.createCanvas("lamp", 16, 48);
    const lampCtx = lampCanvas.getContext();
    lampCtx.imageSmoothingEnabled = false;
    lampCtx.fillStyle = "#2b2c34";
    lampCtx.fillRect(7, 8, 2, 34);
    lampCtx.fillStyle = "#f2d48f";
    lampCtx.fillRect(4, 2, 8, 8);
    lampCtx.fillStyle = "rgba(255, 235, 170, 0.4)";
    lampCtx.fillRect(2, 10, 12, 10);
    lampCanvas.refresh();
  }

  createMenuBackground() {
    const canvas = this.textures.createCanvas("menu_bg", GAME_WIDTH, GAME_HEIGHT);
    const ctx = canvas.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0f1420";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "#1c2433";
    ctx.fillRect(0, 260, GAME_WIDTH, 280);
    ctx.fillStyle = "#2f3b52";
    for (let i = 0; i < 9; i += 1) {
      ctx.fillRect(40 + i * 100, 140 - (i % 2) * 30, 70, 180);
      ctx.fillStyle = i % 2 === 0 ? "#2f3b52" : "#3c4a63";
    }
    ctx.fillStyle = "#f2d48f";
    ctx.fillRect(120, 330, 10, 10);
    ctx.fillRect(480, 300, 10, 10);
    ctx.fillRect(780, 320, 10, 10);
    ctx.fillStyle = "rgba(255, 225, 170, 0.2)";
    ctx.fillRect(110, 340, 30, 20);
    ctx.fillRect(470, 310, 30, 20);
    ctx.fillRect(770, 330, 30, 20);
    canvas.refresh();
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create() {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "menu_bg");
    const background = this.add.rectangle(width / 2, height / 2, width, height, 0x121723, 0.35);

    const title = this.add.text(width / 2, 120, "Barbora", {
      fontFamily: "Trebuchet MS",
      fontSize: "48px",
      color: "#f1efe7",
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(width / 2, 160, "Quiet Journey", {
      fontFamily: "Trebuchet MS",
      fontSize: "20px",
      color: "#b5b9c6",
    });
    subtitle.setOrigin(0.5);

    const buttons = [
      { label: "Play", action: () => this.startNew() },
      { label: "Continue", action: () => this.continueGame() },
      { label: "Save Progress", action: () => this.saveProgress() },
      { label: "Quit", action: () => window.location.reload() },
    ];

    buttons.forEach((button, index) => {
      const btn = this.add.rectangle(width / 2, 240 + index * 60, 220, 42, 0x232a3a, 0.9);
      btn.setStrokeStyle(2, 0x4b5673);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setFillStyle(0x303a52, 1));
      btn.on("pointerout", () => btn.setFillStyle(0x232a3a, 0.9));
      btn.on("pointerdown", button.action);

      const label = this.add.text(btn.x, btn.y, button.label, {
        fontFamily: "Trebuchet MS",
        fontSize: "18px",
        color: "#f3f2ee",
      });
      label.setOrigin(0.5);
    });

    this.statusText = this.add.text(width / 2, height - 60, "", {
      fontFamily: "Trebuchet MS",
      fontSize: "14px",
      color: "#c9c4b8",
    });
    this.statusText.setOrigin(0.5);

    const hint = this.add.text(width / 2, height - 30, "Press M in-game to view memories", {
      fontFamily: "Trebuchet MS",
      fontSize: "12px",
      color: "#8d93a6",
    });
    hint.setOrigin(0.5);

    this.startMenuAudio();
    this.events.once("shutdown", () => this.stopMenuAudio());
  }

  startMenuAudio() {
    if (!this.sound.context) {
      return;
    }
    const ctx = this.sound.context;
    this.menuGain = ctx.createGain();
    this.menuGain.gain.value = 0.035;
    this.menuOsc = ctx.createOscillator();
    this.menuOsc.type = "triangle";
    this.menuOsc.frequency.value = 140;
    this.menuOsc.connect(this.menuGain).connect(ctx.destination);
    this.menuOsc.start();
  }

  stopMenuAudio() {
    if (this.menuOsc) {
      this.menuOsc.stop();
      this.menuOsc.disconnect();
    }
    if (this.menuGain) {
      this.menuGain.disconnect();
    }
  }

  startNew() {
    clearSave();
    this.scene.start("game", { levelIndex: 0, save: createEmptySave() });
  }

  continueGame() {
    const save = loadSave();
    if (!save) {
      this.statusText.setText("No saved journey yet.");
      return;
    }
    this.scene.start("game", { levelIndex: save.levelIndex, save });
  }

  saveProgress() {
    const save = loadSave();
    if (!save) {
      this.statusText.setText("Nothing to save yet.");
      return;
    }
    storeSave(save);
    this.statusText.setText("Progress saved.");
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super("game");
    this.levelIndex = 0;
    this.save = createEmptySave();
    this.memoriesOpen = false;
  }

  init(data) {
    this.levelIndex = data.levelIndex ?? 0;
    this.save = data.save ?? createEmptySave();
  }

  create() {
    this.level = LEVELS[this.levelIndex];
    this.photoTakenCount = this.save.photosByLevel[this.level.key]?.length || 0;
    this.shotsLeft = this.level.shots - this.photoTakenCount;
    this.createBackground();
    this.createPlatforms();
    this.createProps();
    this.createPlayer();
    this.createPhotoSpots();
    this.createVinyls();
    this.createExit();
    this.createUI();
    this.setupControls();
    this.createMemoriesScreen();
    this.createAmbientLight();
    this.startAmbientAudio();
    this.events.once("shutdown", () => this.stopAmbientAudio());
  }

  update(time, delta) {
    if (this.memoriesOpen) {
      return;
    }

    const speed = 170;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;

    if (left) {
      this.player.setVelocityX(-speed);
      this.player.setFlipX(true);
    } else if (right) {
      this.player.setVelocityX(speed);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    if ((this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown) && this.player.body.blocked.down) {
      this.player.setVelocityY(-360);
      this.player.anims.play("jump", true);
    }

    if (!this.player.body.blocked.down) {
      this.player.anims.play("jump", true);
    } else if (left || right) {
      this.player.anims.play("walk", true);
    } else {
      this.player.anims.play("idle", true);
    }

    if (this.level.wind) {
      this.player.setVelocityX(this.player.body.velocity.x + Math.sin(time / 800) * 12);
    }

    this.updatePhotoSpotGlow();
    this.updateVinylRotation(delta);
    this.updateCrates(time);
  }

  createBackground() {
    const backgroundKey = `background_${this.level.key}`;
    if (!this.textures.exists(backgroundKey)) {
      const canvas = this.textures.createCanvas(backgroundKey, GAME_WIDTH, GAME_HEIGHT);
      const ctx = canvas.getContext();
      ctx.imageSmoothingEnabled = false;
      const [c1, c2, c3, c4] = this.level.background.palette;
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      ctx.fillStyle = c2;
      ctx.fillRect(0, 280, GAME_WIDTH, 260);

      ctx.fillStyle = c3;
      for (let i = 0; i < 10; i += 1) {
        ctx.fillRect(40 + i * 90, 220 - (i % 2) * 30, 70, 140 + (i % 3) * 20);
        ctx.fillStyle = i % 2 === 0 ? c3 : c4;
      }

      ctx.fillStyle = c4;
      ctx.fillRect(0, 420, GAME_WIDTH, 120);
      ctx.fillStyle = "rgba(10, 10, 20, 0.2)";
      ctx.fillRect(0, 440, GAME_WIDTH, 100);

      if (this.level.key === "bridge-night") {
        ctx.fillStyle = "#1a1f2d";
        ctx.fillRect(0, 380, GAME_WIDTH, 60);
        ctx.fillStyle = "rgba(55, 70, 90, 0.6)";
        ctx.fillRect(0, 440, GAME_WIDTH, 60);
        ctx.fillStyle = "rgba(120, 140, 170, 0.3)";
        for (let i = 0; i < 6; i += 1) {
          ctx.fillRect(60 + i * 150, 456, 80, 6);
        }
      }

      if (this.level.key === "rooftop") {
        ctx.fillStyle = "#161b27";
        ctx.fillRect(0, 340, GAME_WIDTH, 60);
        ctx.fillStyle = "#1e2636";
        ctx.fillRect(0, 380, GAME_WIDTH, 80);
      }

      if (this.level.key === "graffiti-alley") {
        ctx.fillStyle = "rgba(160, 120, 200, 0.35)";
        for (let i = 0; i < 8; i += 1) {
          ctx.fillRect(20 + i * 120, 200, 60, 40);
        }
      }

      if (this.level.key === "subway-entrance") {
        ctx.fillStyle = "#22323f";
        ctx.fillRect(40, 320, 180, 140);
        ctx.fillStyle = "#38515f";
        ctx.fillRect(60, 340, 140, 40);
        ctx.fillStyle = "#55727a";
        ctx.fillRect(80, 360, 100, 60);
      }

      canvas.refresh();
    }

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backgroundKey).setDepth(-10);
  }

  createPlatforms() {
    this.platforms = this.physics.add.staticGroup();
    this.level.platforms.forEach((platform) => {
      const count = Math.ceil(platform.width / 120);
      for (let i = 0; i < count; i += 1) {
        const x = platform.x - platform.width / 2 + 60 + i * 120;
        const sprite = this.platforms.create(x, platform.y, "platform");
        sprite.setScale(1, platform.height / 20).refreshBody();
      }
    });

    this.movingCrates = this.physics.add.group({ allowGravity: false, immovable: true });
    if (this.level.movingCrates) {
      this.level.movingCrates.forEach((crate) => {
        const sprite = this.movingCrates.create(crate.x, crate.y, "crate");
        sprite.setData("originX", crate.x);
        sprite.setData("range", crate.range);
        sprite.setData("speed", crate.speed);
      });
    }
  }

  createProps() {
    if (this.level.props?.lamps) {
      this.level.props.lamps.forEach((lamp) => {
        this.add.image(lamp.x, lamp.y, "lamp").setDepth(-5);
      });
    }

    if (this.level.props?.bridge) {
      this.add.rectangle(this.level.props.bridge.x, this.level.props.bridge.y, 840, 40, 0x2a2e3a).setDepth(-6);
    }

    if (this.level.props?.cafe) {
      this.add.rectangle(this.level.props.cafe.x, this.level.props.cafe.y - 40, 120, 60, 0x2f3647).setDepth(-6);
      this.add.rectangle(this.level.props.cafe.x, this.level.props.cafe.y - 60, 100, 20, 0x4a515f).setDepth(-5);
    }

    if (this.level.props?.recordShop) {
      const shop = this.level.props.recordShop;
      this.add.rectangle(shop.x, shop.y - 40, 120, 70, 0x2b2f3a).setDepth(-6);
      this.add.rectangle(shop.x, shop.y - 70, 90, 20, 0x3f4758).setDepth(-5);
      this.add.rectangle(shop.x, shop.y - 70, 60, 12, 0xb4835c).setDepth(-4);
      this.add.rectangle(shop.x - 20, shop.y - 30, 18, 18, 0x1a1c25).setDepth(-4);
      this.add.rectangle(shop.x + 10, shop.y - 30, 18, 18, 0x1a1c25).setDepth(-4);
    }

    if (this.level.props?.graffiti) {
      this.level.props.graffiti.forEach((spot) => {
        this.add.rectangle(spot.x, spot.y, 60, 30, 0x6a4a72).setDepth(-6);
        this.add.rectangle(spot.x, spot.y + 12, 50, 10, 0x9b6b7c).setDepth(-6);
      });
    }

    if (this.level.props?.ubahn) {
      this.add.rectangle(this.level.props.ubahn.x, this.level.props.ubahn.y, 120, 80, 0x253b46).setDepth(-6);
      this.add.rectangle(this.level.props.ubahn.x, this.level.props.ubahn.y - 20, 100, 30, 0x345b61).setDepth(-6);
    }

    if (this.level.props?.lights) {
      this.level.props.lights.forEach((light) => {
        const glow = this.add.circle(light.x, light.y, 18, 0xf2d6a0, 0.4).setDepth(-7);
        this.tweens.add({ targets: glow, alpha: { from: 0.2, to: 0.5 }, duration: 1200, yoyo: true, repeat: -1 });
      });
    }

    if (this.level.key === "subway-entrance") {
      const silhouettes = [
        this.add.rectangle(300, 410, 18, 40, 0x1a1f28, 0.7),
        this.add.rectangle(360, 410, 20, 46, 0x1a1f28, 0.6),
        this.add.rectangle(420, 410, 18, 42, 0x1a1f28, 0.5),
      ];
      silhouettes.forEach((silhouette, index) => {
        this.tweens.add({
          targets: silhouette,
          x: silhouette.x + 140 + index * 10,
          duration: 5000 + index * 800,
          yoyo: true,
          repeat: -1,
          ease: "Sine.inOut",
        });
      });
    }

    if (this.level.props?.tower) {
      this.add.rectangle(this.level.props.tower.x, this.level.props.tower.y + 60, 30, 120, 0x323b4b).setDepth(-6);
      this.add.circle(this.level.props.tower.x, this.level.props.tower.y, 26, 0x4a566b).setDepth(-6);
    }

    if (this.level.props?.antennas) {
      this.level.props.antennas.forEach((antenna) => {
        this.add.rectangle(antenna.x, antenna.y, 6, 80, 0x2b2f3a).setDepth(-6);
      });
    }

    if (this.level.key === "bridge-night") {
      const reflection = this.add.rectangle(480, 470, 900, 40, 0x2a3648, 0.5).setDepth(-8);
      this.tweens.add({ targets: reflection, alpha: { from: 0.3, to: 0.6 }, duration: 1600, yoyo: true, repeat: -1 });
    }
  }

  createPlayer() {
    this.player = this.physics.add.sprite(120, 420, "player_idle");
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(18, 28).setOffset(3, 4);

    this.anims.create({
      key: "idle",
      frames: [{ key: "player_idle" }],
      frameRate: 1,
      repeat: -1,
    });
    this.anims.create({
      key: "walk",
      frames: [{ key: "player_walk1" }, { key: "player_walk2" }],
      frameRate: 6,
      repeat: -1,
    });
    this.anims.create({
      key: "jump",
      frames: [{ key: "player_jump" }],
      frameRate: 1,
    });

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.player, this.movingCrates);
  }

  createPhotoSpots() {
    this.photoSpots = this.add.group();
    this.level.photoSpots.forEach((spot) => {
      const glow = this.add.image(spot.x, spot.y, "photo_glow");
      glow.setData("id", spot.id);
      glow.setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.7 }, duration: 1200, yoyo: true, repeat: -1 });
      const frame = this.add.image(spot.x, spot.y, "photo_frame");
      frame.setAlpha(0);
      glow.setData("frame", frame);
      this.photoSpots.add(glow);
    });
  }

  createVinyls() {
    this.vinyls = this.physics.add.group({ allowGravity: false, immovable: true });
    this.level.vinyls.forEach((vinyl) => {
      const sprite = this.vinyls.create(vinyl.x, vinyl.y, `vinyl_${vinyl.id}`);
      sprite.setData("id", vinyl.id);
      sprite.setData("requiresPhoto", vinyl.requiresPhoto || null);
      sprite.setData("hidden", vinyl.hidden || false);
      if (vinyl.hidden) {
        sprite.setAlpha(0.2);
      }
    });

    this.physics.add.overlap(this.player, this.vinyls, this.collectVinyl, null, this);
  }

  createExit() {
    this.exit = this.physics.add.staticImage(this.level.exit.x, this.level.exit.y, "exit_door");
    this.physics.add.overlap(this.player, this.exit, this.reachExit, null, this);
  }

  createUI() {
    this.cameraIcon = this.add.image(40, 30, "camera_icon").setScrollFactor(0);
    this.shotsText = this.add.text(60, 20, `${this.shotsLeft}`, {
      fontSize: "16px",
      color: "#f3efe7",
    });

    this.photoIcon = this.add.image(120, 30, "photo_icon").setScrollFactor(0);
    this.photoCountText = this.add.text(140, 20, `${this.photoTakenCount}`, {
      fontSize: "16px",
      color: "#f3efe7",
    });

    this.vinylText = this.add.text(200, 20, `Vinyls ${this.save.vinyls.length}/6`, {
      fontSize: "16px",
      color: "#b9c1d3",
    });

    this.vinylIcons = Object.keys(VINYL_ALBUMS).map((key, index) => {
      const icon = this.add.image(200 + index * 24, 44, `vinyl_${key}`).setScale(0.8);
      return icon;
    });

    this.levelText = this.add.text(20, 50, this.level.name, {
      fontSize: "14px",
      color: "#8e97aa",
    });

    this.tipText = this.add.text(20, 70, "Press E to photograph glow", {
      fontSize: "12px",
      color: "#6f7890",
    });

    this.updateVinylIcons();
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE,E,M");

    this.input.keyboard.on("keydown-E", () => {
      if (this.memoriesOpen) {
        return;
      }
      this.takePhoto();
    });

    this.input.keyboard.on("keydown-M", () => {
      if (this.memoriesOpen) {
        this.closeMemories();
      } else {
        this.openMemories();
      }
    });
  }

  updatePhotoSpotGlow() {
    this.activeSpot = null;
    this.photoSpots.getChildren().forEach((glow) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, glow.x, glow.y);
      const inRange = distance < 40;
      glow.setAlpha(inRange ? 0.9 : 0.4);
      const frame = glow.getData("frame");
      if (frame) {
        frame.setAlpha(inRange ? 0.9 : 0);
      }
      if (inRange) {
        this.activeSpot = glow.getData("id");
      }
    });
  }

  updateVinylRotation(delta) {
    this.vinyls.getChildren().forEach((vinyl) => {
      vinyl.rotation += delta * 0.001;
    });
  }

  updateCrates(time) {
    if (!this.level.movingCrates) {
      return;
    }
    this.movingCrates.getChildren().forEach((crate) => {
      const originX = crate.getData("originX");
      const range = crate.getData("range");
      const speed = crate.getData("speed");
      crate.x = originX + Math.sin(time / 1000) * range;
      crate.body.updateFromGameObject();
    });
  }

  takePhoto() {
    if (!this.activeSpot || this.shotsLeft <= 0) {
      return;
    }

    const captured = this.save.photosByLevel[this.level.key] || [];
    if (captured.includes(this.activeSpot)) {
      return;
    }

    captured.push(this.activeSpot);
    this.save.photosByLevel[this.level.key] = captured;
    this.photoTakenCount = captured.length;
    this.shotsLeft = Math.max(0, this.level.shots - this.photoTakenCount);
    this.updateUiCounts();
    this.freezeMoment();
    this.flashScreen();
    this.playShutterSound();
    storeSave(this.save);
  }

  freezeMoment() {
    this.physics.world.pause();
    this.player.anims.pause();
    this.time.delayedCall(180, () => {
      this.physics.world.resume();
      this.player.anims.resume();
    });
  }

  collectVinyl(player, vinyl) {
    const id = vinyl.getData("id");
    const requiresPhoto = vinyl.getData("requiresPhoto");
    if (this.save.vinyls.includes(id)) {
      vinyl.destroy();
      return;
    }
    if (requiresPhoto && !(this.save.photosByLevel[this.level.key] || []).includes(requiresPhoto)) {
      return;
    }
    this.save.vinyls.push(id);
    vinyl.destroy();
    this.updateUiCounts();
    storeSave(this.save);
  }

  reachExit() {
    const photos = this.save.photosByLevel[this.level.key] || [];
    if (photos.length < this.level.requiredPhotos) {
      this.tipText.setText("Take more photos to move on.");
      return;
    }

    if (this.level.requiredVinyls) {
      const collectedHere = this.level.vinyls.filter((vinyl) => this.save.vinyls.includes(vinyl.id)).length;
      if (collectedHere < this.level.requiredVinyls) {
        this.tipText.setText("Find a vinyl before leaving.");
        return;
      }
    }

    this.levelIndex += 1;
    if (this.levelIndex >= LEVELS.length) {
      this.save.levelIndex = LEVELS.length - 1;
      storeSave(this.save);
      this.scene.start("ending", { save: this.save });
      return;
    }

    this.save.levelIndex = this.levelIndex;
    storeSave(this.save);
    this.scene.restart({ levelIndex: this.levelIndex, save: this.save });
  }

  updateUiCounts() {
    this.shotsText.setText(`${this.shotsLeft}`);
    this.photoCountText.setText(`${this.photoTakenCount}`);
    this.vinylText.setText(`Vinyls ${this.save.vinyls.length}/6`);
    this.updateVinylIcons();
  }

  updateVinylIcons() {
    if (!this.vinylIcons) {
      return;
    }
    Object.keys(VINYL_ALBUMS).forEach((key, index) => {
      const icon = this.vinylIcons[index];
      if (!icon) {
        return;
      }
      const collected = this.save.vinyls.includes(key);
      icon.setAlpha(collected ? 1 : 0.35);
    });
  }

  flashScreen() {
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.8);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
    const shutter = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "camera_icon");
    shutter.setScale(4);
    this.tweens.add({
      targets: shutter,
      alpha: { from: 1, to: 0 },
      duration: 300,
      onComplete: () => shutter.destroy(),
    });
  }

  playShutterSound() {
    if (!this.sound.context) {
      return;
    }
    const now = this.sound.context.currentTime;
    const oscillator = this.sound.context.createOscillator();
    const gain = this.sound.context.createGain();
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    oscillator.connect(gain).connect(this.sound.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  createMemoriesScreen() {
    this.memoriesGroup = this.add.group();
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 640, 360, 0x0f131e, 0.95);
    panel.setStrokeStyle(2, 0x4f5a75);
    const title = this.add.text(GAME_WIDTH / 2, 120, "Memories", {
      fontSize: "24px",
      color: "#f2efe7",
    });
    title.setOrigin(0.5);

    const hint = this.add.text(GAME_WIDTH / 2, 400, "Press M to return", {
      fontSize: "12px",
      color: "#9fa8bb",
    });
    hint.setOrigin(0.5);

    this.memoriesGroup.addMultiple([panel, title, hint]);
    this.memoriesGroup.setVisible(false);
  }

  openMemories() {
    this.memoriesOpen = true;
    this.memoriesGroup.setVisible(true);

    if (this.memoriesPhotos) {
      this.memoriesPhotos.clear(true, true);
    }
    this.memoriesPhotos = this.add.group();

    const startX = 240;
    const startY = 180;
    let index = 0;
    Object.entries(this.save.photosByLevel).forEach(([levelKey, photos]) => {
      photos.forEach(() => {
        const x = startX + (index % 3) * 160;
        const y = startY + Math.floor(index / 3) * 110;
        const frame = this.add.rectangle(x, y, 120, 80, 0xf1ede4, 1).setStrokeStyle(2, 0xc0b7a8);
        const tint = LEVELS.find((lvl) => lvl.key === levelKey)?.background.palette[3] || "#c2b7a7";
        this.add.rectangle(x, y, 100, 60, Phaser.Display.Color.HexStringToColor(tint).color, 1);
        this.memoriesPhotos.add(frame);
        index += 1;
      });
    });
  }

  closeMemories() {
    this.memoriesOpen = false;
    this.memoriesGroup.setVisible(false);
    if (this.memoriesPhotos) {
      this.memoriesPhotos.clear(true, true);
    }
  }

  createAmbientLight() {
    const ambience = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b0f16, 0.12);
    ambience.setDepth(-9);
  }

  startAmbientAudio() {
    if (!this.sound.context) {
      return;
    }
    const ctx = this.sound.context;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.04;
    this.ambientOsc = ctx.createOscillator();
    this.ambientOsc.type = "sine";
    this.ambientOsc.frequency.value = 170;
    this.ambientOscTwo = ctx.createOscillator();
    this.ambientOscTwo.type = "triangle";
    this.ambientOscTwo.frequency.value = 220;
    this.ambientLfo = ctx.createOscillator();
    this.ambientLfo.frequency.value = 0.08;
    this.ambientLfoGain = ctx.createGain();
    this.ambientLfoGain.gain.value = 18;
    this.ambientLfo.connect(this.ambientLfoGain).connect(this.ambientOscTwo.frequency);
    this.ambientOsc.connect(this.ambientGain);
    this.ambientOscTwo.connect(this.ambientGain);
    this.ambientGain.connect(ctx.destination);
    this.ambientOsc.start();
    this.ambientOscTwo.start();
    this.ambientLfo.start();
  }

  stopAmbientAudio() {
    [this.ambientOsc, this.ambientOscTwo, this.ambientLfo].forEach((osc) => {
      if (osc) {
        osc.stop();
        osc.disconnect();
      }
    });
    if (this.ambientGain) {
      this.ambientGain.disconnect();
    }
    if (this.ambientLfoGain) {
      this.ambientLfoGain.disconnect();
    }
  }
}

class EndingScene extends Phaser.Scene {
  constructor() {
    super("ending");
  }

  init(data) {
    this.save = data.save || createEmptySave();
  }

  create() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0f16, 1);

    const map = this.add.rectangle(width / 2, height / 2, 520, 320, 0x141b26, 1);
    map.setStrokeStyle(2, 0x2c374b);

    for (let i = 0; i < 6; i += 1) {
      const line = this.add.rectangle(width / 2 - 220 + i * 80, height / 2, 3, 260, 0x273344, 0.7);
      line.setAngle(10 - i * 3);
    }

    for (let i = 0; i < 4; i += 1) {
      this.add.rectangle(width / 2, height / 2 - 120 + i * 70, 420, 3, 0x273344, 0.7);
    }

    const dot = this.add.circle(width / 2 + 60, height / 2 - 30, 8, 0xf1d6a1, 0.8);
    this.tweens.add({ targets: dot, alpha: { from: 0.4, to: 1 }, duration: 1200, yoyo: true, repeat: -1 });

    if (this.save.vinyls.length === Object.keys(VINYL_ALBUMS).length) {
      const vinyl = this.add.image(width / 2, height / 2 + 120, "vinyl_radiohead");
      vinyl.setScale(2);
      this.tweens.add({ targets: vinyl, rotation: Math.PI * 2, duration: 4000, repeat: -1 });
      this.playNeedleDrop();
    }

    this.time.delayedCall(6000, () => {
      this.scene.start("menu");
    });
  }

  playNeedleDrop() {
    if (!this.sound.context) {
      return;
    }
    const ctx = this.sound.context;
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * 0.4;
    }
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.15;
    noise.connect(gain).connect(ctx.destination);
    noise.start();
  }
}

function createEmptySave() {
  return {
    levelIndex: 0,
    photosByLevel: {},
    vinyls: [],
  };
}

function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function storeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  pixelArt: true,
  backgroundColor: "#0b0f16",
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 800 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, EndingScene],
};

new Phaser.Game(config);
