// 40 test users. Each one has a phone (or laptop), a sport, a history, a
// habit or two, and a list of things they try to do in the app.

export const DEVICES = {
  "iPhone SE": { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "iPhone 15": { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  "iPhone 15 Pro Max": { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  "Pixel 7": { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  "Galaxy A14": { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "Galaxy Fold (folded)": { viewport: { width: 280, height: 653 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  "iPad": { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  "Laptop": { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  "Small laptop": { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

const P = (name, o) => ({ name, device: "iPhone 15", timezone: "America/New_York", returning: false, faults: {}, ...o });

export const PERSONAS = [
  // Lifters
  P("Maya, first gym week", { device: "iPhone SE", sport: "lifting", journeys: ["liftFirstWorkout", "liftWeeklyGoal", "profile"] }),
  P("Jordan, 2-year lifter", { device: "iPhone 15", sport: "lifting", returning: true, journeys: ["liftRepeatLast", "liftProgress", "liftDelete"] }),
  P("Priya, powerlifter", { device: "Pixel 7", sport: "lifting", returning: true, timezone: "Asia/Kolkata", journeys: ["liftRepeatLast", "liftProgress"] }),
  P("Sam, makes typos", { device: "Galaxy A14", sport: "lifting", journeys: ["liftMistakes"] }),
  P("Alex, double-tapper", { device: "iPhone 15", sport: "lifting", journeys: ["liftDoubleTap", "liftFirstWorkout"] }),
  P("Chris, gets distracted", { device: "iPhone 15 Pro Max", sport: "lifting", journeys: ["liftAbandon"] }),
  P("Dee, custom exercises", { device: "Pixel 7", sport: "lifting", journeys: ["liftCustomExercise"] }),
  P("Ravi, logs yesterday's session", { device: "iPhone SE", sport: "lifting", returning: true, journeys: ["liftBackdate"] }),
  P("Tom, laptop logger", { device: "Laptop", sport: "lifting", returning: true, journeys: ["liftRepeatLast", "liftProgress", "explore"] }),
  P("Kim, rest timer fan", { device: "iPhone 15", sport: "lifting", journeys: ["liftRestTimer"] }),
  P("Lee, folded phone", { device: "Galaxy Fold (folded)", sport: "lifting", returning: true, journeys: ["liftFirstWorkout", "explore"] }),
  P("Ana, gym with bad signal", { device: "iPhone 15", sport: "lifting", returning: true, faults: { latency: 2500 }, journeys: ["liftRepeatLast", "liftDelete"] }),
  P("Ben, wifi keeps dropping", { device: "Pixel 7", sport: "lifting", returning: true, faults: { failWrites: 1 }, journeys: ["liftSaveFails", "liftDelete"] }),
  P("Night owl lifter", { device: "iPhone 15", sport: "lifting", returning: true, clock: "23:50", journeys: ["liftFirstWorkout"] }),

  // Climbers
  P("Zoe, boulderer", { device: "iPhone 15", sport: "climbing", returning: true, journeys: ["climbLog", "climbAnalytics"] }),
  P("Marco, sport climber", { device: "Pixel 7", sport: "climbing", returning: true, journeys: ["climbSportGrade", "climbHome"] }),
  P("Ivy, new climber", { device: "iPhone SE", sport: "climbing", journeys: ["climbFirst", "climbAnalytics"] }),
  P("Hugo, skips fields", { device: "Galaxy A14", sport: "climbing", journeys: ["climbMistakes"] }),
  P("Nina, deletes old climbs", { device: "iPad", sport: "climbing", returning: true, journeys: ["climbDelete"] }),
  P("Climber on flaky wifi", { device: "iPhone 15", sport: "climbing", returning: true, faults: { failWrites: 1 }, journeys: ["climbSaveFails"] }),

  // Food loggers
  P("Grace, counting calories", { device: "iPhone 15", sport: "food", journeys: ["foodSearch", "foodEdit", "foodDashboard"] }),
  P("Omar, eats out a lot", { device: "Pixel 7", sport: "food", journeys: ["foodRestaurant", "foodQuickAddDouble"] }),
  P("Lena, barcode scanner", { device: "iPhone SE", sport: "food", journeys: ["foodBarcode", "foodBarcodeUnknown"] }),
  P("Femi, photo logger", { device: "iPhone 15 Pro Max", sport: "food", journeys: ["foodPhoto", "foodPhotoLimit"] }),
  P("Sara, sets her own goals", { device: "Galaxy A14", sport: "food", returning: true, journeys: ["foodGoals", "foodDashboard"] }),
  P("Will, forgot yesterday", { device: "iPhone 15", sport: "food", returning: true, journeys: ["foodYesterday"] }),
  P("Hana, home cook", { device: "Pixel 7", sport: "food", journeys: ["foodCustom", "foodMine"] }),
  P("Leo, photo of his desk", { device: "iPhone 15", sport: "food", faults: { photoNoFood: true }, journeys: ["foodPhotoNoFood"] }),
  P("Auckland breakfast", { device: "iPhone 15", sport: "food", returning: true, timezone: "Pacific/Auckland", journeys: ["foodSearch", "foodDashboard"] }),
  P("Midnight snacker", { device: "Pixel 7", sport: "food", returning: true, clock: "23:58", journeys: ["foodMidnight"] }),
  P("Food on slow 3G", { device: "Galaxy A14", sport: "food", faults: { latency: 2500 }, journeys: ["foodSearch", "foodQuickAddDouble"] }),
  P("Food logger, wifi drops", { device: "iPhone SE", sport: "food", returning: true, faults: { failWrites: 1 }, journeys: ["foodSaveFails"] }),
  P("Desk-job snacker", { device: "Small laptop", sport: "food", returning: true, journeys: ["foodSearch", "foodDashboard", "explore"] }),
  P("Food on a folded phone", { device: "Galaxy Fold (folded)", sport: "food", journeys: ["foodSearch", "foodGoals"] }),

  // Multi-sport and general
  P("Riley, does everything", { device: "iPhone 15", sport: "lifting", returning: true, journeys: ["sportSwitch", "liftRepeatLast", "foodSearch", "climbLog"] }),
  P("Fast tapper", { device: "Pixel 7", sport: "lifting", returning: true, journeys: ["fastTapper"] }),
  P("Explorer on iPad", { device: "iPad", sport: "food", returning: true, journeys: ["explore", "sportSwitch", "explore"] }),
  P("Signs out and back", { device: "iPhone SE", sport: "lifting", returning: true, journeys: ["profile", "landing"] }),
  P("Visitor, not signed in", { device: "iPhone 15", sport: "lifting", signedOut: true, journeys: ["landing"] }),
  P("Database is paused", { device: "iPhone 15", sport: "lifting", returning: true, faults: { failAll: true }, journeys: ["pausedDb"] }),
];
