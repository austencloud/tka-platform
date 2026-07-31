export type ShareActionTone = "default" | "success" | "danger";

export interface ShareActionMenuItem {
  id: string;
  label: string;
  icon: string;
  section?: string;
  disabled?: boolean;
  busy?: boolean;
  tone?: ShareActionTone;
  closeOnSelect?: boolean;
}
