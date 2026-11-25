jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
      Text,
      createAnimatedComponent: (component: unknown) => component,
    },
    View,
    Text,
    createAnimatedComponent: (component: unknown) => component,
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useAnimatedProps: () => ({}),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    runOnJS: (fn: unknown) => fn,
  };
});
