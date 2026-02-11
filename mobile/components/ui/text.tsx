import { Text as RNText, type TextProps } from "react-native";

type Variant = "heading" | "subheading" | "body" | "caption" | "price";

const variantClasses: Record<Variant, string> = {
  heading: "text-2xl font-bold text-text-primary",
  subheading: "text-lg font-semibold text-text-primary",
  body: "text-base text-text-secondary",
  caption: "text-xs text-text-tertiary",
  price: "text-xl font-bold text-brand-green",
};

interface StyledTextProps extends TextProps {
  variant?: Variant;
}

export function StyledText({
  variant = "body",
  className = "",
  ...props
}: StyledTextProps) {
  return (
    <RNText
      className={`${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
