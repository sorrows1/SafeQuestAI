import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { darkTheme } from '@/theme';
import { Avatar } from '../Avatar';
import { MessageBubble } from '../MessageBubble';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);
}

describe('messaging primitives', () => {
  it('keeps the avatar DOM node stable across unrelated parent rerenders', () => {
    const { rerender } = renderWithTheme(<MessageBubble content="Hello" speakerLabel="Initiator" side="left" pace="normal" />);
    const avatar = screen.getByLabelText('Initiator');
    rerender(
      <ThemeProvider theme={darkTheme}>
        <MessageBubble content="Hello" speakerLabel="Initiator" side="left" pace="normal" />
      </ThemeProvider>
    );
    expect(screen.getByLabelText('Initiator')).toBe(avatar);
  });

  it('keeps a standalone avatar mounted with stable props', () => {
    const { rerender } = renderWithTheme(<Avatar speakerLabel="Respondent" role="respondent" />);
    const avatar = screen.getByLabelText('Respondent');
    rerender(
      <ThemeProvider theme={darkTheme}>
        <Avatar speakerLabel="Respondent" role="respondent" />
      </ThemeProvider>
    );
    expect(screen.getByLabelText('Respondent')).toBe(avatar);
  });
});
