import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

export function useImagePicker() {
  const [image, setImage] = useState<PickedImage | null>(null);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso à câmera para fotografar encartes. Ative nas configurações do dispositivo.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Precisamos de acesso às fotos para selecionar imagens de encartes. Ative nas configurações do dispositivo.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  }, []);

  const clearImage = useCallback(() => {
    setImage(null);
  }, []);

  return { image, pickFromCamera, pickFromGallery, clearImage };
}
