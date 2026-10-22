import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

import { Botao } from '@/components/botao';
import { Tela } from '@/components/tela';
import { encerrarSessao, lembrarSessao, obterToken } from '@/lib/sessao';

export default function InicioScreen() {
  // Chegar aqui significa primeiro acesso e tutorial concluídos
  useEffect(() => {
    lembrarSessao();
  }, []);

  if (!obterToken()) {
    return <Redirect href="/" />;
  }

  async function sair() {
    await encerrarSessao();
    router.replace('/');
  }

  return (
    <Tela
      titulo="Seu acesso está pronto"
      descricao="Em breve você vai acompanhar por aqui suas consultas de pré-natal, seus pontos e os cupons disponíveis.">
      <Botao rotulo="Sair" estilo="secundario" onPress={sair} />
    </Tela>
  );
}
