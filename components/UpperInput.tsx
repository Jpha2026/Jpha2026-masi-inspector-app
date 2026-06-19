import { TextInput, TextInputProps } from "react-native";

export function UpperInput({
  onChangeText,
  autoCapitalize,
  keyboardType,
  secureTextEntry,
  ...props
}: TextInputProps) {
  const shouldUpper =
    !secureTextEntry &&
    keyboardType !== "email-address" &&
    autoCapitalize !== "none";

  return (
    <TextInput
      autoCapitalize={autoCapitalize ?? (shouldUpper ? "characters" : "none")}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      onChangeText={
        shouldUpper ? (text) => onChangeText?.(text.toUpperCase()) : onChangeText
      }
      {...props}
    />
  );
}
