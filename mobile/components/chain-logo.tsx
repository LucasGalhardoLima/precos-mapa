import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { CHAIN_LOGOS } from '../constants/chain-logos';
import { chainLabelForStore } from '../lib/chains';

// Monochrome chain symbol, 28 px tall in a fixed 44 px slot so rows line up
// whatever the symbol's aspect ratio (Tenda is wide, Jaú Serve nearly square).
// Decorative: the chain name is always printed next to it, so screen readers
// skip it. `chain` is a chain label ("Jaú Serve") or a branch name
// ("Amarelinha Loja 21 Flamboyant"); anything unknown renders nothing, and the
// row just closes the gap like a product without image_url.
const HEIGHT = 28;
const SLOT_WIDTH = 44;

export function ChainLogo({ chain, color }: { chain: string; color: string }) {
  const label = chainLabelForStore(chain);
  const shape = label ? CHAIN_LOGOS[label] : null;
  if (!shape) return null;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${shape.viewBox}"><path fill="${color}" fill-rule="evenodd" d="${shape.d}"/></svg>`;
  return (
    <View style={{ width: SLOT_WIDTH, height: HEIGHT }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml xml={xml} width={SLOT_WIDTH} height={HEIGHT} />
    </View>
  );
}
