/*
 * RASCUNHO TÉCNICO — NÃO É PARECER JURÍDICO.
 *
 * Escrito a partir do que o app MLP (mobile/app, hooks, lib) de fato coleta
 * em main, para substituir a política antiga (login, favoritos, RevenueCat,
 * Stripe…), que descrevia um app que não existe mais. Precisa de revisão
 * jurídica antes de ir para as lojas. Todo <PREENCHER>/<DEFINIR> aparece na
 * página de propósito: publicar com um deles visível é melhor do que publicar
 * uma afirmação inventada.
 *
 * Fontes conferidas: hooks/use-analytics.ts (analytics_events: event_type,
 * user_id | anonymous_id, store_id, product_id, metadata, region = cidade),
 * packages/shared use-location (coordenadas só na consulta; reverse geocode
 * do sistema), migrations 079 (city_interest, sem id de usuário), 084
 * (tracked_items), 049 (eventos anônimos); use-push-notifications
 * (getExpoPushTokenAsync). PostHog está no package.json mas nada o importa —
 * por isso não aparece aqui.
 *
 * Se o que o app coleta mudar, esta página muda no mesmo PR.
 */
import type { Metadata } from "next";
import { Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacidade, termos e sobre | Poup",
  description:
    "Política de privacidade, termos de uso e informações sobre o app Poup, que compara preços nos mercados de Matão-SP.",
};

// Lacuna visível: o que ainda depende de decisão do controlador.
function Pendente({ children }: { children: string }) {
  return (
    <span className="rounded bg-amber-100 px-1 font-mono text-[0.85em] text-amber-900">
      {children}
    </span>
  );
}

function Secao({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article>
      <h3 className="text-base font-semibold text-[var(--color-ink)]">{title}</h3>
      <div className="mt-2 space-y-3 text-sm leading-7 text-[var(--color-muted)]">{children}</div>
    </article>
  );
}

const cartao =
  "scroll-mt-6 rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-8 px-5 py-12 sm:px-6 sm:py-16">
      <header className={cartao}>
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-deep)]">
          <Shield className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          Privacidade, termos e sobre o Poup
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
          Nesta página: <a className="underline" href="#privacidade">política de privacidade</a>,{" "}
          <a className="underline" href="#termos">termos de uso</a> e{" "}
          <a className="underline" href="#sobre">sobre o Poup</a>.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
          Em vigor a partir de: <Pendente>{"<PREENCHER: data de vigência>"}</Pendente>
        </p>
      </header>

      <section id="privacidade" className={cartao}>
        <h2 className="mb-6 text-xl font-bold text-[var(--color-ink)]">Política de privacidade</h2>
        <div className="space-y-6">
          <Secao title="1. Quem é responsável pelos seus dados">
            <p>
              O Poup é um aplicativo que mostra onde um produto está mais barato hoje nos mercados de
              Matão-SP. O controlador dos dados é{" "}
              <Pendente>{"<PREENCHER: nome ou razão social do controlador>"}</Pendente>, inscrito no{" "}
              <Pendente>{"<PREENCHER: CPF/CNPJ>"}</Pendente>. O encarregado pelo tratamento de dados
              pessoais pode ser contatado em{" "}
              <Pendente>{"<PREENCHER: e-mail do encarregado>"}</Pendente>.
            </p>
          </Secao>

          <Secao title="2. O que o Poup não pede">
            <p>
              O app não tem cadastro nem login. Não pedimos nome, CPF, telefone, senha ou dados de
              pagamento, e o Poup é gratuito. A câmera só é usada, quando você toca em
              &quot;Escanear&quot;, para ler o código de barras no próprio aparelho: nenhuma imagem é
              enviada ou guardada, só o número do código lido.
            </p>
          </Secao>

          <Secao title="3. O que coletamos">
            <p>
              <strong>Identificador anônimo.</strong> Na primeira vez que você abre o app, ele gera um
              código aleatório e o guarda no aparelho. Quando você acompanha um item (no app ou ao
              escolher itens no início), o app também cria uma conta anônima no nosso servidor, com
              outro código aleatório. Nenhum dos dois traz seu nome, e-mail ou telefone.
            </p>
            <p>
              <strong>Eventos de uso.</strong> Registramos o que é feito no app, ligado a esse
              identificador anônimo: buscas (incluindo o texto digitado), códigos de barras lidos,
              telas e produtos abertos, mercados exibidos, o mercado escolhido como &quot;onde você
              está&quot;, itens acompanhados e preço-alvo, e mudanças nos ajustes de aviso. Cada evento
              leva a data e a hora e, quando conhecida, a cidade (por exemplo, &quot;Matão, SP&quot;).
            </p>
            <p>
              <strong>Localização.</strong> Com a sua permissão, o app lê a localização aproximada do
              aparelho para saber qual mercado está mais perto de você. As coordenadas são enviadas ao
              nosso servidor só no momento da consulta, para calcular a distância até os mercados, e
              não são gravadas nas nossas tabelas. Para descobrir o nome da cidade, o app usa o serviço
              do próprio sistema do aparelho (Apple ou Google). O que guardamos é só a cidade. Se você
              não permitir, pode digitar a cidade, e o app funciona sem saber onde você está.
            </p>
            <p>
              <strong>Itens acompanhados.</strong> Quando você acompanha um item, guardamos o produto
              (ou o tipo de produto e o tamanho), o preço-alvo, se você definir um, e a data, ligados à
              sua conta anônima.
            </p>
            <p>
              <strong>Token de notificação.</strong> Só se você ativar os avisos e permitir
              notificações. O sistema do aparelho (Apple ou Google) gera um token, que o app registra no
              serviço de notificações da Expo para poder enviar o aviso de preço.{" "}
              <Pendente>
                {"<DEFINIR: confirmar se, na data de vigência, o token já é gravado no nosso servidor, ligado à conta anônima — hoje, em main, não é>"}
              </Pendente>
            </p>
            <p>
              <strong>E-mail, só em &quot;Fora de Matão&quot;.</strong> Se você está em outra cidade,
              pode deixar um e-mail, se quiser, para ser avisado quando o Poup chegar lá. Guardamos o
              e-mail, a cidade informada e a data, sem ligar ao identificador anônimo. É o único dado
              de contato que o app recebe, e ele não é usado para mais nada.
            </p>
            <p>
              <strong>Dados técnicos de conexão.</strong> Como em qualquer serviço na internet, nossos
              provedores de infraestrutura registram dados técnicos das requisições, como endereço IP e
              data e hora.
            </p>
            <p>
              Algumas escolhas, como o mercado que você marcou como &quot;onde você está&quot; e a
              preferência de avisos, ficam só no seu aparelho.
            </p>
          </Secao>

          <Secao title="4. Para que usamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>Mostrar os preços de hoje e o mercado mais perto de você.</li>
              <li>Guardar os itens que você acompanha e avisar quando o preço cair abaixo do alvo.</li>
              <li>
                Entender, de forma agregada, como o app é usado (por exemplo, quantas buscas chegam a um
                preço) para melhorá-lo.
              </li>
              <li>
                Produzir estatísticas agregadas sobre procura de produtos em Matão, que podem ser
                compartilhadas com mercados e outros parceiros, sem nenhum identificador seu.
              </li>
              <li>Avisar, por e-mail, quem pediu, quando o Poup chegar à sua cidade.</li>
            </ul>
            <p>Não vendemos dados pessoais e não usamos seus dados para publicidade.</p>
          </Secao>

          <Secao title="5. Base legal">
            <p>
              Localização, notificações e e-mail: consentimento (LGPD, art. 7º, I), dado pela permissão
              do aparelho ou ao deixar o e-mail, e revogável a qualquer momento. Itens acompanhados:
              execução do serviço que você pediu (art. 7º, V). Eventos de uso e dados técnicos:{" "}
              <Pendente>{"<DEFINIR: base legal — o rascunho assume legítimo interesse (art. 7º, IX)>"}</Pendente>.
            </p>
          </Secao>

          <Secao title="6. Com quem os dados são tratados">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong>: banco de dados, contas anônimas e servidor do app. Guarda os
                eventos, os itens acompanhados, o e-mail de &quot;Fora de Matão&quot; e os dados técnicos
                de conexão. Servidores em{" "}
                <Pendente>{"<DEFINIR: região dos servidores do Supabase>"}</Pendente>.
              </li>
              <li>
                <strong>Expo</strong>: serviço de envio de notificações, só para quem ativou os avisos.
              </li>
              <li>
                <strong>Apple e Google</strong>: entregam as notificações aos aparelhos e, pelo sistema do
                aparelho, convertem a localização no nome da cidade.
              </li>
            </ul>
            <p>
              Esses serviços podem processar dados fora do Brasil; nesses casos a transferência segue o
              que a LGPD prevê para transferência internacional.
            </p>
          </Secao>

          <Secao title="7. Por quanto tempo guardamos">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Itens acompanhados: até você removê-los em Ajustes; removido, o registro é apagado.
              </li>
              <li>
                Eventos de uso: <Pendente>{"<DEFINIR: prazo de retenção dos eventos de uso>"}</Pendente>
              </li>
              <li>
                Conta anônima: <Pendente>{"<DEFINIR: prazo para apagar contas anônimas sem uso>"}</Pendente>
              </li>
              <li>
                Token de notificação:{" "}
                <Pendente>{"<DEFINIR: prazo de retenção do token de notificação>"}</Pendente>
              </li>
              <li>
                E-mail de &quot;Fora de Matão&quot;:{" "}
                <Pendente>{"<DEFINIR: até o aviso de chegada à cidade? prazo máximo?>"}</Pendente>
              </li>
              <li>
                Dados técnicos de conexão:{" "}
                <Pendente>{"<DEFINIR: prazo de retenção dos registros de acesso>"}</Pendente>
              </li>
            </ul>
            <p>
              Estatísticas agregadas, que não identificam ninguém, podem ser mantidas sem prazo.
            </p>
          </Secao>

          <Secao title="8. Seus direitos e como exercê-los">
            <p>
              Você pode pedir confirmação de que tratamos seus dados, acesso a eles, correção,
              anonimização, eliminação, portabilidade, informação sobre com quem são compartilhados, e
              revogar o consentimento (LGPD, art. 18). Para isso, escreva para{" "}
              <Pendente>{"<PREENCHER: e-mail do encarregado>"}</Pendente>. Responderemos em até{" "}
              <Pendente>{"<DEFINIR: prazo de resposta>"}</Pendente>.
            </p>
            <p>
              Como o app não tem cadastro, não conseguimos achar seus eventos só pelo seu nome ou
              e-mail.{" "}
              <Pendente>
                {"<DEFINIR: como o titular indica qual identificador anônimo é o dele>"}
              </Pendente>{" "}
              Para o e-mail de &quot;Fora de Matão&quot;, basta escrever a partir do mesmo endereço.
            </p>
            <p>
              Sem precisar falar conosco, você também pode: negar ou retirar as permissões de
              localização e notificação nos ajustes do aparelho, a qualquer momento; e apagar o app,
              o que remove do aparelho o identificador anônimo e as preferências guardadas nele (os
              dados já enviados ao servidor continuam lá até o prazo do item 7 ou até um pedido de
              eliminação).
            </p>
            <p>
              Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
            </p>
          </Secao>

          <Secao title="9. Segurança">
            <p>
              A comunicação entre o app e o servidor é criptografada (HTTPS). No banco, cada conta
              anônima só consegue ler os próprios itens acompanhados, e o e-mail de &quot;Fora de
              Matão&quot; não pode ser lido pelo app depois de enviado.
            </p>
          </Secao>

          <Secao title="10. Crianças e adolescentes">
            <p>
              O Poup não é direcionado a crianças e não coleta de propósito dados de crianças.{" "}
              <Pendente>{"<DEFINIR: idade mínima e classificação etária nas lojas>"}</Pendente>
            </p>
          </Secao>

          <Secao title="11. Mudanças nesta política">
            <p>
              Quando esta política mudar, a nova versão será publicada nesta página, com nova data de
              vigência.{" "}
              <Pendente>{"<DEFINIR: se e como avisar no app sobre mudanças relevantes>"}</Pendente>
            </p>
          </Secao>
        </div>
      </section>

      <section id="termos" className={cartao}>
        <h2 className="mb-6 text-xl font-bold text-[var(--color-ink)]">Termos de uso</h2>
        <div className="space-y-6">
          <Secao title="Serviço gratuito">
            <p>O Poup é gratuito, sem assinatura, compras ou anúncios.</p>
          </Secao>
          <Secao title="Preços são informativos">
            <p>
              Os preços são coletados automaticamente dos canais online dos mercados, uma vez por dia,
              e podem estar diferentes do preço na loja, que é sempre o que vale. Não garantimos que os
              preços, a disponibilidade dos produtos ou o serviço estejam sempre corretos ou no ar, e
              não nos responsabilizamos por decisões de compra tomadas com base neles.
            </p>
          </Secao>
          <Secao title="Mercados não afiliados">
            <p>
              Os nomes e logotipos dos mercados (Savegnago, Jaú Serve, Tenda e Amarelinha) aparecem só
              para identificar onde cada preço foi encontrado. O Poup não é afiliado, patrocinado nem
              endossado por nenhum deles.
            </p>
          </Secao>
          <Secao title="Lei e foro">
            <p>
              Estes termos seguem a lei brasileira. Foro:{" "}
              <Pendente>{"<DEFINIR: foro>"}</Pendente>
            </p>
          </Secao>
        </div>
      </section>

      <section id="sobre" className={cartao}>
        <h2 className="mb-6 text-xl font-bold text-[var(--color-ink)]">Sobre o Poup</h2>
        <div className="space-y-3 text-sm leading-7 text-[var(--color-muted)]">
          <p>
            O Poup responde uma pergunta: onde este produto está mais barato hoje nos mercados de
            Matão-SP. Os preços são atualizados todo dia de madrugada.
          </p>
          <p>
            Contato: <Pendente>{"<PREENCHER: e-mail de contato>"}</Pendente>
          </p>
        </div>
      </section>
    </main>
  );
}
