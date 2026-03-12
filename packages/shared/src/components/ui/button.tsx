import React from "react";
import { Pressable, Text } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

const containerClasses: Record<Variant, string> = {
  primary: "bg-brand-green rounded-xl py-4 px-6 items-center",
  secondary: "border-2 border-brand-green rounded-xl py-4 px-6 items-center",
  ghost: "py-2 px-4 items-center",
};

const textClasses: Record<Variant, string> = {
  primary: "text-white font-bold text-base",
  secondary: "text-brand-green font-bold text-base",
  ghost: "text-brand-green font-semibold text-sm",
};

export interface StyledButtonProps {
  variant?: Variant;
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
}

export function StyledButton({
  variant = "primary",
  title,
  className = "",
  onPress,
  disabled,
}: StyledButtonProps) {
  return (
    <Pressable
      className={`${containerClasses[variant]} active:opacity-80 ${className}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className={textClasses[variant]}>{title}</Text>
    </Pressable>
  );
}
