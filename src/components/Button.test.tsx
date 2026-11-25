import { render, screen } from '@testing-library/react-native';

import { Button } from '@/components/primitives';
import { ThemeProvider } from '@/design/theme';

describe('Button', () => {
  test('renders its label', async () => {
    await render(
      <ThemeProvider preference="light" fontsReady={false}>
        <Button label="Save expense" onPress={() => undefined} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Save expense')).toBeTruthy();
  });
});
