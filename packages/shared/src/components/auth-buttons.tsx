import { View, Text, Pressable, Platform, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { Colors } from '../constants/colors';

interface AuthButtonsProps {
  onSuccess?: (userId: string) => void;
}

export function AuthButtons({ onSuccess }: AuthButtonsProps) {
  const { signInWithGoogle, signInWithApple, signInWithEmail } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogle = async () => {
    try {
      setIsLoading(true);
      const data = await signInWithGoogle();
      if (data.session?.user) onSuccess?.(data.session.user.id);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao entrar com Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApple = async () => {
    try {
      setIsLoading(true);
      const data = await signInWithApple();
      if (data.session?.user) onSuccess?.(data.session.user.id);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao entrar com Apple');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmail = async () => {
    try {
      setIsLoading(true);
      const data = await signInWithEmail(email.trim(), password);
      if (data.session?.user) onSuccess?.(data.session.user.id);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Falha ao entrar com email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="gap-3">
      {/* Google Sign-In */}
      <Pressable
        onPress={handleGoogle}
        disabled={isLoading}
        className="flex-row items-center justify-center gap-3 bg-white border border-border rounded-xl py-3.5 px-6 active:opacity-80"
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={Colors.text.secondary} />
        ) : (
          <>
            <Text className="text-lg">G</Text>
            <Text className="text-base font-semibold text-text-primary">
              Entrar com Google
            </Text>
          </>
        )}
      </Pressable>

      {/* Apple Sign-In (iOS only) */}
      {Platform.OS === 'ios' && (
        <Pressable
          onPress={handleApple}
          disabled={isLoading}
          className="flex-row items-center justify-center gap-3 bg-black rounded-xl py-3.5 px-6 active:opacity-80"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Text className="text-lg text-white"></Text>
              <Text className="text-base font-semibold text-white">
                Entrar com Apple
              </Text>
            </>
          )}
        </Pressable>
      )}

      {/* Divider */}
      <View className="flex-row items-center gap-3 my-1">
        <View className="flex-1 h-px bg-border" />
        <Text className="text-sm text-text-secondary">ou</Text>
        <View className="flex-1 h-px bg-border" />
      </View>

      {/* Email/Password toggle */}
      <Pressable onPress={() => setShowEmail(!showEmail)} disabled={isLoading}>
        <Text className="text-sm text-brand-green text-center font-medium">
          Entrar com email
        </Text>
      </Pressable>

      {/* Email/Password form */}
      {showEmail && (
        <View className="gap-3">
          <TextInput
            className="bg-white border border-border rounded-xl py-3 px-4 text-base text-text-primary"
            placeholder="Email"
            placeholderTextColor={Colors.text.secondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />
          <TextInput
            className="bg-white border border-border rounded-xl py-3 px-4 text-base text-text-primary"
            placeholder="Senha"
            placeholderTextColor={Colors.text.secondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />
          <Pressable
            onPress={handleEmail}
            disabled={isLoading || !email || !password}
            className="items-center justify-center bg-brand-green rounded-xl py-3.5 px-6 active:opacity-80 disabled:opacity-50"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">Entrar</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
