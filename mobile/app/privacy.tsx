import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

const PRIVACY_SECTIONS = [
  {
    title: '1. Dados coletados',
    body: 'Coletamos seu nome, e-mail, localizacao aproximada (quando autorizada), produtos favoritos, alertas de preco e historico de buscas. Dados de pagamento sao processados diretamente pela Apple/Google (consumidores) ou Stripe (lojistas), sem armazenamento em nossos servidores.',
  },
  {
    title: '2. Finalidade do tratamento',
    body: 'Seus dados sao utilizados para: exibir ofertas proximas a voce, enviar alertas de preco, otimizar listas de compras, personalizar sua experiencia e gerar estatisticas anonimas para lojistas.',
  },
  {
    title: '3. Base legal (LGPD Art. 7)',
    body: 'O tratamento dos seus dados e baseado no consentimento (Art. 7, I) para funcionalidades opcionais e na execucao do contrato (Art. 7, V) para funcionalidades essenciais do servico.',
  },
  {
    title: '4. Compartilhamento',
    body: 'Seus dados pessoais NAO sao vendidos a terceiros. Compartilhamos dados anonimos e agregados com lojistas parceiros para fins estatisticos. Utilizamos servicos de infraestrutura (Supabase, RevenueCat) que processam dados conforme suas proprias politicas de privacidade.',
  },
  {
    title: '5. Retencao',
    body: 'Dados de conta sao mantidos enquanto sua conta estiver ativa. Historicos de preco sao retidos por ate 90 dias. Apos exclusao da conta, seus dados pessoais sao removidos em ate 30 dias.',
  },
  {
    title: '6. Seus direitos (LGPD Art. 18)',
    body: 'Voce pode: acessar seus dados, solicitar correcao, solicitar exclusao da conta, exportar seus dados em formato JSON, revogar consentimento a qualquer momento. Todas essas acoes estao disponiveis na tela de Configuracoes do aplicativo.',
  },
  {
    title: '7. Seguranca',
    body: 'Utilizamos criptografia em transito (TLS/SSL), autenticacao segura via Google/Apple Sign-In, e controle de acesso por Row Level Security (RLS) no banco de dados. Seus dados sao armazenados em servidores com certificacao SOC 2.',
  },
  {
    title: '8. Contato do DPO',
    body: 'Para duvidas sobre privacidade, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail: privacidade@precomapa.com.br',
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 pt-4 pb-2 gap-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <ChevronLeft size={24} color={Colors.text.primary} />
        </Pressable>
        <Shield size={20} color={Colors.brand.green} />
        <Text className="text-xl font-bold text-text-primary">
          Politica de Privacidade
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <Text className="text-xs text-text-tertiary mt-2 mb-4">
          Ultima atualizacao: 12 de fevereiro de 2026
        </Text>

        {PRIVACY_SECTIONS.map((section) => (
          <View key={section.title} className="mb-5">
            <Text className="text-sm font-bold text-text-primary mb-1">
              {section.title}
            </Text>
            <Text className="text-sm text-text-secondary leading-5">
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
