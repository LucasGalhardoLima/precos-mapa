import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

const PRIVACY_SECTIONS = [
  {
    title: '1. Dados coletados',
    body: 'Coletamos seu nome, e-mail, localização aproximada (quando autorizada), produtos favoritos, alertas de preço e histórico de buscas. Dados de pagamento são processados diretamente pela Apple/Google (consumidores) ou Stripe (lojistas), sem armazenamento em nossos servidores.',
  },
  {
    title: '2. Finalidade do tratamento',
    body: 'Seus dados são utilizados para: exibir ofertas próximas a você, enviar alertas de preço, otimizar listas de compras, personalizar sua experiência e gerar estatísticas anônimas para lojistas.',
  },
  {
    title: '3. Base legal (LGPD Art. 7)',
    body: 'O tratamento dos seus dados é baseado no consentimento (Art. 7, I) para funcionalidades opcionais e na execução do contrato (Art. 7, V) para funcionalidades essenciais do serviço.',
  },
  {
    title: '4. Compartilhamento',
    body: 'Seus dados pessoais NÃO são vendidos a terceiros. Compartilhamos dados anônimos e agregados com lojistas parceiros para fins estatísticos. Utilizamos serviços de infraestrutura (Supabase, RevenueCat) que processam dados conforme suas próprias políticas de privacidade.',
  },
  {
    title: '5. Retenção',
    body: 'Dados de conta são mantidos enquanto sua conta estiver ativa. Históricos de preço são retidos por até 90 dias. Após exclusão da conta, seus dados pessoais são removidos em até 30 dias.',
  },
  {
    title: '6. Seus direitos (LGPD Art. 18)',
    body: 'Você pode: acessar seus dados, solicitar correção, solicitar exclusão da conta, exportar seus dados em formato JSON, revogar consentimento a qualquer momento. Todas essas ações estão disponíveis na tela de Configurações do aplicativo.',
  },
  {
    title: '7. Segurança',
    body: 'Utilizamos criptografia em trânsito (TLS/SSL), autenticação segura via Google/Apple Sign-In, e controle de acesso por Row Level Security (RLS) no banco de dados. Seus dados são armazenados em servidores com certificação SOC 2.',
  },
  {
    title: '8. Contato do DPO',
    body: 'Para dúvidas sobre privacidade, entre em contato com nosso Encarregado de Dados (DPO) pelo e-mail: privacidade@poup.com.br',
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
          Política de Privacidade
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerClassName="pb-8">
        <Text className="text-xs text-text-tertiary mt-2 mb-4">
          Última atualização: 12 de fevereiro de 2026
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
