/// <reference types="jest" />

import { render, screen } from '@testing-library/react-native';

import {
  CartaoAgendamento,
  SecaoAgendamentos,
  separarPorData,
  type Agendamento,
} from '@/components/agendamento';

// aaaa-mm-dd local, deslocado em dias a partir de hoje
function dia(deslocamento: number) {
  const data = new Date();
  data.setDate(data.getDate() + deslocamento);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${String(data.getDate()).padStart(2, '0')}`;
}

function agendamento(id: number, dataPrevista: string, extra: Partial<Agendamento> = {}): Agendamento {
  return {
    id,
    tipo: `Exame ${id}`,
    categoria: 'EXAME',
    pontosBase: 10,
    dataPrevista,
    status: 'AGENDADO',
    ...extra,
  };
}

const ids = (lista: Agendamento[]) => lista.map((a) => a.id);

describe('separarPorData', () => {
  it('hoje conta como próximo; ontem já passou', () => {
    const { proximos, passados } = separarPorData([agendamento(1, dia(0)), agendamento(2, dia(-1))]);

    expect(ids(proximos)).toEqual([1]);
    expect(ids(passados)).toEqual([2]);
  });

  it('próximos do mais cedo ao mais tarde; passados do mais recente ao mais antigo', () => {
    const { proximos, passados } = separarPorData([
      agendamento(1, dia(30)),
      agendamento(2, dia(-30)),
      agendamento(3, dia(1)),
      agendamento(4, dia(-1)),
      agendamento(5, dia(7)),
      agendamento(6, '2025-12-31'),
    ]);

    expect(ids(proximos)).toEqual([3, 5, 1]);
    expect(ids(passados)).toEqual([4, 2, 6]);
  });

  it('mesma data desempata pelo id, na mesma direção da ordem', () => {
    const { proximos, passados } = separarPorData([
      agendamento(9, dia(2)),
      agendamento(3, dia(2)),
      agendamento(7, dia(-2)),
      agendamento(8, dia(-2)),
    ]);

    expect(ids(proximos)).toEqual([3, 9]);
    expect(ids(passados)).toEqual([8, 7]);
  });

  it('não altera a lista recebida', () => {
    const lista = [agendamento(2, dia(5)), agendamento(1, dia(1))];
    separarPorData(lista);

    expect(ids(lista)).toEqual([2, 1]);
  });

  it('lista vazia', () => {
    expect(separarPorData([])).toEqual({ proximos: [], passados: [] });
  });
});

describe('CartaoAgendamento', () => {
  it.each([
    ['AGENDADO', 'Pendente'],
    ['REALIZADO', 'Realizado'],
    ['NAO_COMPARECEU', 'Não compareceu'],
  ] as const)('status %p aparece como %p', async (status, rotulo) => {
    await render(<CartaoAgendamento agendamento={agendamento(1, '2026-03-05', { status })} />);

    expect(screen.getByText(rotulo)).toBeTruthy();
  });

  it('mostra o tipo, a data em dd/mm/aaaa e a observação', async () => {
    await render(
      <CartaoAgendamento
        agendamento={agendamento(1, '2026-03-05', { tipo: 'Ultrassom', observacao: 'Ir em jejum' })}
      />,
    );

    expect(screen.getByText('Ultrassom')).toBeTruthy();
    expect(screen.getByText('05/03/2026')).toBeTruthy();
    expect(screen.getByText('Ir em jejum')).toBeTruthy();
  });

  it('não mostra os pontos base', async () => {
    await render(<CartaoAgendamento agendamento={agendamento(1, '2026-03-05', { pontosBase: 37 })} />);

    expect(screen.queryByText(/37/)).toBeNull();
  });
});

describe('SecaoAgendamentos', () => {
  it('mostra o título com a quantidade e os cartões', async () => {
    await render(
      <SecaoAgendamentos titulo="Próximos" agendamentos={[agendamento(1, dia(1)), agendamento(2, dia(2))]} />,
    );

    expect(screen.getByRole('header', { name: 'Próximos (2)' })).toBeTruthy();
    expect(screen.getByText('Exame 1')).toBeTruthy();
    expect(screen.getByText('Exame 2')).toBeTruthy();
  });

  it('seção vazia não aparece', async () => {
    await render(<SecaoAgendamentos titulo="Próximos" agendamentos={[]} />);

    expect(screen.queryByText(/Próximos/)).toBeNull();
  });
});
