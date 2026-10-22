import { useEffect } from 'react';

import { Tela } from '@/components/tela';
import { lembrarSessao } from '@/lib/sessao';

export default function InicioScreen() {
  // Chegar aqui significa primeiro acesso e tutorial concluídos
  useEffect(() => {
    lembrarSessao();
  }, []);

  return (
    <Tela
      titulo="Seu acesso está pronto"
      descricao="Em breve você vai acompanhar por aqui suas consultas de pré-natal, seus pontos e os cupons disponíveis."
      edges={['top', 'left', 'right']}>
      {null}
    </Tela>
  );
}
