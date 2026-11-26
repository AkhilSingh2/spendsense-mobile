import { Platform, Text, View } from 'react-native';

/** Small note on the hosted web demo (STATIC_DEMO build) so it reads as a demo, not a live service. */
export function DemoNote() {
  if (Platform.OS !== 'web' || process.env.EXPO_PUBLIC_STATIC_DEMO !== 'true') return null;
  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      testID="demo-note"
      style={{
        position: 'absolute',
        top: 8,
        right: 12,
        zIndex: 50,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(28, 25, 22, 0.12)',
        backgroundColor: 'rgba(255, 253, 248, 0.92)',
      }}
    >
      <Text style={{ fontSize: 11, color: '#5c564c', fontFamily: 'Outfit_500Medium' }}>
        Demo mode · sample data stays in this browser
      </Text>
    </View>
  );
}
