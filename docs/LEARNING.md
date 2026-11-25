# Learning SpendSense

A study guide for the parts of this repo that are different from a typical web app. Each section points at real files. The exercises are small enough to finish in one sitting and specific enough that you can tell whether they worked.

You do not need an API key for any exercise except the last optional one.

## 1. React Native is not the DOM

React Native components (`View`, `Text`, `Pressable`) are instructions for native views, or for `react-native-web` when you run `npm run web`. There is no `div`, no CSS file, and no hover. Layout is Yoga flexbox: `flexDirection` defaults to `column`, and you set `flex: 1` when a child should fill the parent.

What changes versus the web:

- Text must live in `Text`. A string inside a `View` throws.
- Styles are objects, usually from `StyleSheet.create` or inline objects that read the theme. There is no cascade.
- Platform differences are files, not user-agent checks. `src/services/notifications.ts` schedules a local notification. `src/services/notifications.web.ts` only raises the in-app notice. Metro picks the file. Jest, which pretends to be iOS, loads the native one.
- Safe areas matter. `useSafeAreaInsets` keeps the home title out from under the status bar and the tab bar off the home indicator.

Look at `src/components/primitives.tsx` for the shared text, button, and keypad, and `src/design/theme.tsx` for the paper/jade palettes.

**Exercise.** On the home quick-add field, show a one-line hint only on web: “Press Enter to read the line.” Use `Platform.OS` or a `HomeHint.web.tsx` / `HomeHint.tsx` pair. Confirm the native file renders nothing and the web file renders the hint.

## 2. Expo Router

Routes are files under `app/`.

- `app/_layout.tsx` is the root stack and the place providers live (ledger, theme, toasts, lock).
- `app/(tabs)/` is a group. The parentheses do not appear in the URL. `index`, `activity`, `insights`, and `budgets` are the four tabs.
- `app/expense/new.tsx` and `app/expense/[id].tsx` are a stack presented as a modal from the root (`presentation: 'modal'` on the `expense` screen).
- `app/index.tsx` only redirects: onboarding until it is finished, otherwise the tabs.

Navigation is `router.push('/settings')` and `router.back()`. Search params (`?mode=receipt`) arrive through `useLocalSearchParams`.

Typed routes are off (`experiments.typedRoutes` in `app.json`) so `tsc` does not depend on a generated route map. Turning them on is a good follow-up once you are comfortable with the file tree.

**Exercise.** Add `app/merchant/[name].tsx` that lists expenses whose merchant matches the param, and link to it from an `ExpenseRow`. The row already receives the transaction.

## 3. Local-first data

The UI never talks to SQL directly. `LedgerProvider` in `src/data/store.tsx` holds a `Snapshot` and writes it through a `LedgerPersistence`.

- `src/data/sqlite.ts` creates real tables (`transactions`, `budgets`, `recurring`, `alerts`, `outbox`, `settings`) and replaces the rows inside `withTransactionAsync`. Load is a set of `SELECT`s.
- `src/data/local.ts` is the same interface over `localStorage`, used when SQLite cannot open (common on web if wasm fails). Settings shows which driver you got.
- Mutations go through pure helpers: `pushOutbox`, `alertsToFire`, `materializeRecurring`. The outbox is the list of changes a later sync would upload.
- Money is integer minor units. `toMinor(450, 'INR')` is `45000`. See `src/domain/money.ts` and `src/domain/money.test.ts`.

Opening the app also runs `materializeRecurring`. A rule whose `nextDate` is today or earlier becomes a transaction, once. The second open is a no-op. That logic is tested without React.

**Exercise.** Add a `note` search that is satisfied by SQL, not by filtering the snapshot in JavaScript. Add `searchTransactions(db, query)` on the SQLite persistence, and a test that runs the same SQL string against whatever driver you can stand up. Keep the screen on the snapshot until you are ready to thread the query through.

## 4. Budgets, insights, and alerts

`src/domain/budgets.ts` converts each expense into the home currency and divides by the cap.

Thresholds default to 75%, 90%, and 100%. Jumping from 10% to 120% records all three crossings so they cannot fire again, and the store announces only the highest. That is why one lunch does not produce three notifications.

`src/domain/insights.ts` builds the sentences on the Insights tab. Rent is not multiplied by the remaining days. Discretionary spend is. Read `projectedMinor` before you change the copy, and keep the test in `insights.test.ts` green. It exists so a “helpful” refactor does not forecast ₹8 lakh of rent.

**Exercise.** Add a sentence when a single category is over its own cap, using `budgetStatuses`. Cover it with a fixture that has a ₹1,000 food cap and ₹1,200 of food.

## 5. The parser

`parseExpense` in `src/parse/llm.ts`:

1. Ask the `LlmClient`.
2. On throw or empty result, call `parseWithRules`.

`MockLlmClient` is the default client. It runs `replaceSpokenNumbers` and then the rules, and reports the source as `llm`. `OpenAiLlmClient` is constructed only when `EXPO_PUBLIC_AI_MODE=openai` and a key is present. `coerceModelPayload` checks the JSON before the app trusts it.

`parseWithRules` (`src/parse/rules.ts`) is deterministic: amount, currency hint, merchant list, category words, and dates relative to `ctx.today`. Tests pin `today` to `2026-11-25`, so “yesterday” is always 24 November.

**Exercise.** Teach the rules the word “chai” as food, and “a grand” as 1000 in the spoken-number pass (the mock already understands “a grand” if `grand` is a scale — read `numberWords.ts` and add a test that locks the behavior you want). Add one case to `parseExpense.test.ts` for each.

## 6. Reanimated and gestures

Reanimated 4 shared values drive the things that should not re-render React 60 times a second:

- `PressableScale` springs to 0.97 on press (`src/components/primitives.tsx`).
- `Ring` and `ProgressBar` interpolate with `withTiming` (`src/components/charts.tsx`).
- `ExpenseRow` uses Gesture Handler’s `usePanGesture` to reveal delete. The row also has a delete button, because a swipe cannot be the only way to remove something.

`useTheme().reduceMotion` skips the timing and jumps to the final value. Check that path when you add motion.

**Exercise.** Animate the active tab pill in `src/components/TabBar.tsx` with a shared value that springs to the focused index, instead of swapping background color instantly. Respect reduce motion.

## 7. Notifications and the lock

Budget alerts call `publishAlert`. On a device that schedules a local notification (`trigger: null` shows it immediately) and always emits an in-app notice. On the web, only the notice exists, because `expo-notifications` is not a web API. The split is the two files in `src/services/`.

The lock is a full-screen overlay in `app/_layout.tsx`, not a route, so a deep link cannot paint amounts underneath it. The PIN is salted and hashed with `expo-crypto` SHA-256. Five misses wait 30 seconds. Biometrics call `expo-local-authentication` and fail soft. Expo Go on iOS does not include Face ID; a development build does. The PIN is the path that works in every preview.

**Exercise.** Add a weekly reminder, Sundays at 18:00, that says how much of the monthly cap is left. Schedule it with `SchedulableTriggerInputTypes` when notifications are enabled, and cancel it when they are not. On web, show the same sentence as a notice from a button in Settings so you can test without a phone.

## 8. EAS, when Expo Go is not enough

Expo Go already contains the native modules this app uses (SQLite, notifications, image picker, local authentication, Reanimated). That is why `npm start` is enough for day-to-day work.

Expo Go is not the binary you ship. `eas.json` has three profiles:

- `development` — a dev client, including the iOS simulator
- `preview` — an internal Android APK you can hand to someone
- `production` — store build, version auto-increment

`eas init` attaches a project id. `eas build --profile preview --platform android` runs in the cloud. You need an Expo account. iOS store builds need an Apple Developer account. Play listings need Play Console. None of that is required for the web preview or for tests.

Native projects are generated at build time (Continuous Native Generation). Change permissions and icons in `app.json`. Do not commit `ios/` or `android/`.

**Exercise.** Run `npx expo-doctor`. Fix anything it reports. Then, if you have an Expo account, `eas init` and a preview build. If you do not, write down which `app.json` fields the preview profile will read (package name, icon, plugins) and confirm they match the app you have been running.

## 9. Optional: a real model

Set in `.env` (never commit it):

```
EXPO_PUBLIC_AI_MODE=openai
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
```

Restart Metro so the public env is inlined. The client posts to chat completions and still falls back to rules if the network or the JSON is bad. `coerceModelPayload` is the gate. Add a test that feeds it a fenced \`\`\`json block and one that feeds it a category you do not have, and confirm the unknown category becomes `other`.

## How to know you understood it

You can explain, without looking, why “four hundred fifty lunch yesterday” fails in Rules only and succeeds in the default mode, why rent is not multiplied in the projection, and why the web build does not import `expo-notifications`. If those three are clear, the rest of the repo is the same idea repeated: a pure function, a platform edge, and a test that locks the pure part.
