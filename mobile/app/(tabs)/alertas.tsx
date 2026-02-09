import { useState } from "react";
import { Switch, StyleSheet, Text, View } from "react-native";
import { mobileAlerts } from "../../src/data/mock";
import { ScreenShell } from "../../src/components/screen-shell";
import { SectionCard } from "../../src/components/section-card";
import { formatCurrency } from "../../src/ui/format";
import { palette } from "../../src/ui/theme";

export default function AlertasScreen() {
  const [alerts, setAlerts] = useState(mobileAlerts);

  return (
    <ScreenShell title="Alertas" subtitle="Receba notificações de preço com base em metas por categoria.">
      <SectionCard title="Minhas regras de alerta" subtitle="Ative ou desative preferências instantaneamente.">
        {alerts.map((alert, index) => (
          <View key={alert.id} style={styles.alertRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertMeta}>{alert.category} · até {formatCurrency(alert.maxPrice)}</Text>
            </View>
            <Switch
              value={alert.enabled}
              onValueChange={(value) =>
                setAlerts((prev) => prev.map((entry, entryIndex) => (entryIndex === index ? { ...entry, enabled: value } : entry)))
              }
              trackColor={{ false: "#D3DDD7", true: "#92E2BF" }}
              thumbColor={alert.enabled ? palette.primaryDeep : "#f4f3f4"}
            />
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Perfil" subtitle="Preferências gerais de notificações da conta.">
        <View style={styles.profileBox}>
          <Text style={styles.profileTitle}>Maria Silva</Text>
          <Text style={styles.profileMeta}>Membro desde janeiro de 2026 · Matão/SP</Text>
          <Text style={styles.profileSmall}>Canal padrão: push + e-mail semanal</Text>
        </View>
      </SectionCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  alertRow: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    backgroundColor: palette.white,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.ink,
  },
  alertMeta: {
    marginTop: 2,
    fontSize: 12,
    color: palette.muted,
  },
  profileBox: {
    borderRadius: 14,
    backgroundColor: palette.surfaceStrong,
    padding: 12,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.ink,
  },
  profileMeta: {
    marginTop: 2,
    fontSize: 12,
    color: palette.muted,
  },
  profileSmall: {
    marginTop: 8,
    fontSize: 12,
    color: palette.muted,
  },
});
