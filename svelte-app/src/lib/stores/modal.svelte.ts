// Modal store — promise-based alert/confirm/prompt, mirrors js/modal.js.
export type ModalKind = 'alert' | 'confirm' | 'prompt';

export interface ModalState {
	open: boolean;
	kind: ModalKind;
	message: string;
	danger: boolean;
	confirmLabel: string;
	cancelLabel: string;
	defaultValue: string;
	placeholder: string;
}

const initial: ModalState = {
	open: false,
	kind: 'alert',
	message: '',
	danger: false,
	confirmLabel: 'OK',
	cancelLabel: 'Cancel',
	defaultValue: '',
	placeholder: ''
};

class ModalStore {
	state = $state<ModalState>({ ...initial });
	private resolver: ((value: boolean | string | null) => void) | null = null;

	private open(partial: Partial<ModalState>): Promise<boolean | string | null> {
		this.state = { ...initial, ...partial, open: true };
		return new Promise((resolve) => {
			this.resolver = resolve;
		});
	}

	alert(message: string, confirmLabel = 'OK'): Promise<boolean | string | null> {
		return this.open({ kind: 'alert', message, confirmLabel });
	}

	confirm(
		message: string,
		opts: { danger?: boolean; confirmLabel?: string; cancelLabel?: string } = {}
	): Promise<boolean> {
		return this.open({
			kind: 'confirm',
			message,
			danger: opts.danger ?? false,
			confirmLabel: opts.confirmLabel ?? 'Confirm',
			cancelLabel: opts.cancelLabel ?? 'Cancel'
		}) as Promise<boolean>;
	}

	prompt(
		message: string,
		opts: { defaultValue?: string; placeholder?: string } = {}
	): Promise<string | null> {
		return this.open({
			kind: 'prompt',
			message,
			defaultValue: opts.defaultValue ?? '',
			placeholder: opts.placeholder ?? '',
			confirmLabel: 'OK'
		}) as Promise<string | null>;
	}

	resolve(value: boolean | string | null): void {
		this.state = { ...this.state, open: false };
		this.resolver?.(value);
		this.resolver = null;
	}
}

export const modal = new ModalStore();
export const modalAlert = (m: string) => modal.alert(m);
export const modalConfirm = (m: string, o?: { danger?: boolean }) => modal.confirm(m, o);
export const modalPrompt = (m: string, o?: { defaultValue?: string; placeholder?: string }) =>
	modal.prompt(m, o);
