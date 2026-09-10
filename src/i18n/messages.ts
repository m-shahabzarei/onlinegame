import { platformMessages } from "./platform-messages";
import { gameMessages } from "./game-messages";
import { pageMessages } from "./page-messages";
const baseMessages = {
  en: {
    navigation: {
      games: "Games",
      profile: "Profile",
      settings: "Settings",
      login: "Log in",
      guest: "Guest",
      register: "Create account",
      logout: "Sign out",
      language: "Language",
      skipToContent: "Skip to main content",
    },
    game: {
      playSolo: "Play Solo",
      playCoop: "Play Co-op",
      soloDescription: "One player, no teammate required.",
      coopDescription: "Invite one partner to the shared arena.",
    },
    loading: {
      generic: "Loading…",
      lobby: "Loading lobby",
      rooms: "Loading rooms",
      gameplay: "Loading gameplay",
    },
    settings: {
      motion: "Motion",
      reduceMotion: "Reduce motion",
      reduceMotionHelp: "Minimize non-essential animation and transitions.",
      audio: "Audio",
      sound: "Sound effects",
      soundHelp: "Enable or mute gameplay sound effects.",
      save: "Save preferences",
      saving: "Saving preferences…",
    },
    metadata: {
      title: "TwoPlayer",
      description: "Focused cooperative games and solo survival sessions.",
    },
    auth: {
      newOperator: "New operator",
      secureAccess: "Secure access",
      createTitle: "Create your TwoPlayer account",
      welcomeBack: "Welcome back",
      registerIntro:
        "Set up a profile now and keep your progress ready for cooperative play.",
      loginIntro:
        "Sign in to continue your profile setup and discover the next mission.",
      username: "Username",
      usernameHelp: "3–32 characters: letters, numbers, and underscores.",
      email: "Email",
      emailOrUsername: "Email or username",
      displayName: "Display name",
      displayNameHelp: "This is the name other players will see.",
      password: "Password",
      confirmPassword: "Confirm password",
      keepSignedIn: "Keep me signed in",
      keepSignedInHelp: "Use the configured session duration on this device.",
      createAccount: "Create account",
      signIn: "Sign in",
      creatingAccount: "Creating account…",
      signingIn: "Signing in…",
      alreadyHaveAccount: "Already have an account?",
      newToTwoPlayer: "New to TwoPlayer?",
      createAnAccount: "Create an account",
      continueGuest: "Continue as a guest",
      temporaryAccess: "Temporary access",
      exploreGuest: "Explore as a guest",
      guestIntro:
        "Start browsing immediately with a temporary identity. A permanent account creates a separate profile, so temporary edits will not carry over.",
      guestBrowse: "Browse the home page and game catalog.",
      guestReview: "Review planned game details and platform updates.",
      guestRooms:
        "Create or join multiplayer rooms with this guest identity. Keep this browser session to return to your lobby.",
      startingGuest: "Starting guest session…",
      signInInstead: "Sign in instead",
      guestLimitations: "Guest mode limitations",
    },
    common: {
      cancel: "Cancel",
      retry: "Retry",
      close: "Close",
      loading: "Loading…",
      publicRoom: "Public room",
      privateRoom: "Private room",
      roomCode: "Room code",
      joinRoom: "Join room",
      createRoom: "Create room",
      backToGame: "Back to game",
      onlyOpen: "Only rooms with space",
      inviteCode: "Have an invite code?",
      joinWithCode: "Join with code",
      joining: "Joining",
      creating: "Creating room",
      ready: "Ready",
      notReady: "Not ready",
    },
    shop: {
      safeRoom: "Safe Room · Shop open",
      title: "Resupply and upgrade",
      scrap: "SCRAP",
      weapons: "Weapons",
      support: "Support",
      upgrades: "Weapon upgrades",
      ammo: "Ammo refill",
      armor: "Armor plating",
      medkit: "Medkit",
      grenade: "Grenade",
      sentry: "Sentry turret",
      equipped: "Equipped",
      owned: "Owned",
      close: "Close shop",
    },
  },
  fa: {
    navigation: {
      games: "بازی‌ها",
      profile: "پروفایل",
      settings: "تنظیمات",
      login: "ورود",
      guest: "مهمان",
      register: "ساخت حساب",
      logout: "خروج",
      language: "زبان",
      skipToContent: "پرش به محتوای اصلی",
    },
    game: {
      playSolo: "بازی تک‌نفره",
      playCoop: "بازی همکاری",
      soloDescription: "یک بازیکن؛ بدون نیاز به هم‌تیمی.",
      coopDescription: "یک هم‌تیمی را به میدان مشترک دعوت کنید.",
    },
    loading: {
      generic: "در حال بارگذاری…",
      lobby: "در حال بارگذاری لابی",
      rooms: "در حال بارگذاری اتاق‌ها",
      gameplay: "در حال بارگذاری بازی",
    },
    settings: {
      motion: "حرکت",
      reduceMotion: "کاهش حرکت",
      reduceMotionHelp: "پویانمایی‌های غیرضروری را کم کنید.",
      audio: "صدا",
      sound: "جلوه‌های صوتی",
      soundHelp: "جلوه‌های صوتی بازی را فعال یا بی‌صدا کنید.",
      save: "ذخیره تنظیمات",
      saving: "در حال ذخیره…",
    },
    metadata: {
      title: "TwoPlayer",
      description: "بازی‌های همکاری و تجربه‌های بقا برای یک یا دو بازیکن.",
    },
    auth: {
      newOperator: "اپراتور جدید",
      secureAccess: "ورود امن",
      createTitle: "حساب TwoPlayer خود را بسازید",
      welcomeBack: "خوش آمدید",
      registerIntro:
        "پروفایل خود را بسازید تا پیشرفتتان برای بازی همکاری آماده بماند.",
      loginIntro: "برای ادامه تنظیم پروفایل و کشف مأموریت بعدی وارد شوید.",
      username: "نام کاربری",
      usernameHelp: "۳ تا ۳۲ نویسه: حروف، اعداد و زیرخط.",
      email: "ایمیل",
      emailOrUsername: "ایمیل یا نام کاربری",
      displayName: "نام نمایشی",
      displayNameHelp: "این نام را بازیکنان دیگر خواهند دید.",
      password: "گذرواژه",
      confirmPassword: "تأیید گذرواژه",
      keepSignedIn: "ورود من را حفظ کن",
      keepSignedInHelp: "مدت نشست تنظیم‌شده را در این دستگاه استفاده کن.",
      createAccount: "ساخت حساب",
      signIn: "ورود",
      creatingAccount: "در حال ساخت حساب…",
      signingIn: "در حال ورود…",
      alreadyHaveAccount: "حساب دارید؟",
      newToTwoPlayer: "تازه به TwoPlayer پیوسته‌اید؟",
      createAnAccount: "ساخت حساب",
      continueGuest: "ادامه به‌عنوان مهمان",
      temporaryAccess: "دسترسی موقت",
      exploreGuest: "کاوش به‌عنوان مهمان",
      guestIntro:
        "با هویت موقت فوراً مرور کنید. حساب دائمی پروفایل جداگانه‌ای می‌سازد و ویرایش‌های موقت منتقل نمی‌شوند.",
      guestBrowse: "صفحه اصلی و فهرست بازی‌ها را مرور کنید.",
      guestReview: "جزئیات بازی‌های آینده و اخبار پلتفرم را ببینید.",
      guestRooms:
        "با این هویت مهمان اتاق بسازید یا وارد شوید. برای بازگشت به لابی، این نشست مرورگر را حفظ کنید.",
      startingGuest: "در حال شروع نشست مهمان…",
      signInInstead: "ورود به‌جای آن",
      guestLimitations: "محدودیت‌های حالت مهمان",
    },
    common: {
      cancel: "لغو",
      retry: "تلاش دوباره",
      close: "بستن",
      loading: "در حال بارگذاری…",
      publicRoom: "اتاق عمومی",
      privateRoom: "اتاق خصوصی",
      roomCode: "کد اتاق",
      joinRoom: "ورود به اتاق",
      createRoom: "ساخت اتاق",
      backToGame: "بازگشت به بازی",
      onlyOpen: "فقط اتاق‌های دارای ظرفیت",
      inviteCode: "کد دعوت دارید؟",
      joinWithCode: "ورود با کد",
      joining: "در حال ورود",
      creating: "در حال ساخت اتاق",
      ready: "آماده",
      notReady: "نا‌آماده",
    },
    shop: {
      safeRoom: "اتاق امن · فروشگاه باز است",
      title: "تجهیز و ارتقا",
      scrap: "قراضه",
      weapons: "سلاح‌ها",
      support: "پشتیبانی",
      upgrades: "ارتقای سلاح",
      ammo: "پر کردن مهمات",
      armor: "زره",
      medkit: "جعبه کمک‌های اولیه",
      grenade: "نارنجک",
      sentry: "برجک نگهبان",
      equipped: "مجهز",
      owned: "دارید",
      close: "بستن فروشگاه",
    },
  },
} as const;

export const messages = {
  en: {
    ...baseMessages.en,
    ...platformMessages.en,
    ...gameMessages.en,
    ...pageMessages.en,
  },
  fa: {
    ...baseMessages.fa,
    ...platformMessages.fa,
    ...gameMessages.fa,
    ...pageMessages.fa,
  },
} as const;
export type Locale = "en" | "fa";
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends
    string | { readonly one: string; readonly other: string }
    ? K
    : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];
export type TranslationKey = LeafPaths<typeof messages.en>;
type PathValue<T, P extends string> = P extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? PathValue<T[Head], Tail>
    : never
  : P extends keyof T
    ? T[P]
    : never;
export type TranslationValue<K extends TranslationKey> = PathValue<
  typeof messages.en,
  K
>;
type CatalogSchema<T> = {
  [K in keyof T]: T[K] extends string ? string : CatalogSchema<T[K]>;
};
const persianSchema: CatalogSchema<typeof messages.en> = messages.fa;
void persianSchema;
