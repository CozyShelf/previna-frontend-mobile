/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AbasCupons } from '@/components/abas-cupons';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockReplace = router.replace as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

it('mostra as duas abas, com a Loja ativa', async () => {
  await render(<AbasCupons ativa="loja" />);

  expect(screen.getAllByRole('tab').map((aba) => aba.props.accessibilityState)).toEqual([
    { selected: true },
    { selected: false },
  ]);
  expect(screen.getByRole('tab', { name: 'Loja Cupons' })).toBeSelected();
  expect(screen.getByRole('tab', { name: 'Cupons resgatados' })).not.toBeSelected();
});

it('na Loja, tocar em "Cupons resgatados" troca de tela sem empilhar', async () => {
  await render(<AbasCupons ativa="loja" />);

  await fireEvent.press(screen.getByRole('tab', { name: 'Cupons resgatados' }));

  expect(mockReplace).toHaveBeenCalledWith('/cupons/resgatados');
});

it('nos resgatados, tocar em "Loja Cupons" volta para a Loja sem empilhar', async () => {
  await render(<AbasCupons ativa="resgatados" />);

  expect(screen.getByRole('tab', { name: 'Cupons resgatados' })).toBeSelected();
  await fireEvent.press(screen.getByRole('tab', { name: 'Loja Cupons' }));

  expect(mockReplace).toHaveBeenCalledWith('/cupons');
});

it('tocar na aba ativa não navega', async () => {
  await render(<AbasCupons ativa="resgatados" />);

  await fireEvent.press(screen.getByRole('tab', { name: 'Cupons resgatados' }));

  expect(mockReplace).not.toHaveBeenCalled();
});
