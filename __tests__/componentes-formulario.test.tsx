/// <reference types="jest" />

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Campo } from '@/components/campo';
import { ItemPontos } from '@/components/item-pontos';
import { Opcoes } from '@/components/opcoes';
import { Cores } from '@/constants/theme';

function corDaBorda(rotulo: string) {
  return StyleSheet.flatten(screen.getByLabelText(rotulo).props.style).borderColor;
}

describe('Campo', () => {
  it('liga o rótulo ao campo e mostra a dica', async () => {
    await render(<Campo rotulo="E-mail" dica="Opcional." value="" onChangeText={jest.fn()} />);

    const campo = screen.getByLabelText('E-mail');
    expect(campo.props.accessibilityHint).toBe('Opcional.');
    expect(screen.getByText('Opcional.')).toBeTruthy();
  });

  it('o erro substitui a dica no texto e na dica de acessibilidade', async () => {
    await render(<Campo rotulo="E-mail" dica="Opcional." erro="E-mail inválido." />);

    expect(screen.getByText('E-mail inválido.')).toBeTruthy();
    expect(screen.queryByText('Opcional.')).toBeNull();
    expect(screen.getByLabelText('E-mail').props.accessibilityHint).toBe('E-mail inválido.');
    expect(corDaBorda('E-mail')).toBe(Cores.erro);
  });

  it('sem dica nem erro não mostra texto de apoio', async () => {
    await render(<Campo rotulo="Login" />);

    expect(screen.getByLabelText('Login').props.accessibilityHint).toBeUndefined();
  });

  it('repassa a digitação', async () => {
    const onChangeText = jest.fn();
    await render(<Campo rotulo="Login" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Login'), 'maria');
    expect(onChangeText).toHaveBeenCalledWith('maria');
  });

  it('destaca a borda com foco e repassa foco e saída do campo', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<Campo rotulo="Login" onFocus={onFocus} onBlur={onBlur} />);
    expect(corDaBorda('Login')).toBe(Cores.borda);

    await fireEvent(screen.getByLabelText('Login'), 'focus', {});
    expect(onFocus).toHaveBeenCalled();
    expect(corDaBorda('Login')).toBe(Cores.previna600);

    await fireEvent(screen.getByLabelText('Login'), 'blur', {});
    expect(onBlur).toHaveBeenCalled();
    expect(corDaBorda('Login')).toBe(Cores.borda);
  });

  it('foco e saída funcionam sem callbacks', async () => {
    await render(<Campo rotulo="Login" />);

    await fireEvent(screen.getByLabelText('Login'), 'focus', {});
    await fireEvent(screen.getByLabelText('Login'), 'blur', {});
    expect(corDaBorda('Login')).toBe(Cores.borda);
  });
});

describe('Opcoes', () => {
  const opcoes = [
    { valor: 'CREDITO' as const, rotulo: 'Ganhos' },
    { valor: 'DEBITO' as const, rotulo: 'Gastos' },
  ];

  it('marca a opção selecionada', async () => {
    await render(<Opcoes rotulo="Tipo" opcoes={opcoes} selecionada="DEBITO" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Tipo').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'Gastos' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Ganhos' })).not.toBeChecked();
  });

  it('tocar numa opção desmarcada seleciona ela', async () => {
    const onChange = jest.fn();
    await render(<Opcoes rotulo="Tipo" opcoes={opcoes} selecionada="DEBITO" onChange={onChange} />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Ganhos' }));
    expect(onChange).toHaveBeenCalledWith('CREDITO');
  });

  it('tocar na opção marcada desmarca', async () => {
    const onChange = jest.fn();
    await render(<Opcoes rotulo="Tipo" opcoes={opcoes} selecionada="DEBITO" onChange={onChange} />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Gastos' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe('ItemPontos', () => {
  it('ganho mostra o sinal de mais, a categoria e a data', async () => {
    await render(
      <ItemPontos titulo="Ultrassom" categoria="Exame" dataHora="2026-03-10T12:00:00Z" pontos={50} />,
    );

    expect(screen.getByText('Ultrassom')).toBeTruthy();
    expect(screen.getByText('Exame · 10/03/2026')).toBeTruthy();
    expect(screen.getByText('+50')).toBeTruthy();
    expect(screen.getByLabelText('Ultrassom, Exame · 10/03/2026, ganhou 50 pontos')).toBeTruthy();
  });

  it('gasto mostra o sinal de menos, sem categoria', async () => {
    await render(<ItemPontos titulo="Cupom Fralda RN" dataHora="2026-03-10T12:00:00Z" pontos={-100} />);

    expect(screen.getByText('10/03/2026')).toBeTruthy();
    expect(screen.getByText('−100')).toBeTruthy();
    expect(screen.getByLabelText('Cupom Fralda RN, 10/03/2026, gastou 100 pontos')).toBeTruthy();
  });
});
