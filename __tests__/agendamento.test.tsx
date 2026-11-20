/// <reference types="jest" />

import { render, screen } from '@testing-library/react-native';

import {
  CartaoAgendamento,
  SecaoAgendamentos,
  separarAgendamentos,
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

  it('com o total, o título conta todos mesmo mostrando só uma parte', async () => {
    await render(
      <SecaoAgendamentos titulo="Pendentes" agendamentos={[agendamento(1, dia(1))]} total={5} />,
    );

    expect(screen.getByRole('header', { name: 'Pendentes (5)' })).toBeTruthy();
  });

  it('seção vazia não aparece', async () => {
    await render(<SecaoAgendamentos titulo="Próximos" agendamentos={[]} />);

    expect(screen.queryByText(/Próximos/)).toBeNull();
  });

  it('seção vazia com explicação mostra o título sem contagem e o texto', async () => {
    await render(<SecaoAgendamentos titulo="Pendentes" agendamentos={[]} vazio="Nada por aqui." />);

    expect(screen.getByRole('header', { name: 'Pendentes' })).toBeTruthy();
    expect(screen.getByText('Nada por aqui.')).toBeTruthy();
  });

  it('com itens, a explicação de vazio não aparece', async () => {
    await render(
      <SecaoAgendamentos titulo="Pendentes" agendamentos={[agendamento(1, dia(1))]} vazio="Nada por aqui." />,
    );

    expect(screen.getByRole('header', { name: 'Pendentes (1)' })).toBeTruthy();
    expect(screen.queryByText('Nada por aqui.')).toBeNull();
  });
});

describe('separarAgendamentos', () => {
  const ids = (lista: Agendamento[]) => lista.map((a) => a.id);

  it('pendentes mantêm a ordem da API; concluídos vão do desfecho mais recente ao mais antigo', () => {
    const { pendentes, concluidos } = separarAgendamentos([
      agendamento(5, '2026-11-25'),
      agendamento(6, '2026-12-01'),
      agendamento(1, '2026-09-01', { status: 'REALIZADO', dataConfirmacao: '2026-09-02T08:00:00' }),
      agendamento(2, '2026-10-01', { status: 'REALIZADO', dataConfirmacao: '2026-10-01T15:00:00.5' }),
      agendamento(3, '2026-08-01', { status: 'NAO_COMPARECEU', dataConfirmacao: '2026-10-01T15:00:00' }),
    ]);

    expect(ids(pendentes)).toEqual([5, 6]);
    expect(ids(concluidos)).toEqual([2, 3, 1]);
  });

  it('no empate do desfecho, o id maior vem primeiro, e sem data de confirmação vai para o fim', () => {
    const { concluidos } = separarAgendamentos([
      agendamento(1, '2026-09-01', { status: 'REALIZADO' }),
      agendamento(2, '2026-09-01', { status: 'REALIZADO', dataConfirmacao: '2026-09-02T08:00:00' }),
      agendamento(4, '2026-09-01', { status: 'NAO_COMPARECEU', dataConfirmacao: '2026-09-02T08:00:00' }),
    ]);

    expect(ids(concluidos)).toEqual([4, 2, 1]);
  });

  it('não altera a lista recebida', () => {
    const lista = [
      agendamento(1, '2026-09-01', { status: 'REALIZADO', dataConfirmacao: '2026-09-01T08:00:00' }),
      agendamento(2, '2026-09-01', { status: 'REALIZADO', dataConfirmacao: '2026-09-02T08:00:00' }),
    ];
    separarAgendamentos(lista);

    expect(ids(lista)).toEqual([1, 2]);
  });
});
