// Re-export everything from the router and loader for convenience
export { registerCommand, registerButton, registerModal, routeInteraction } from './router';
export type { CommandModule, ButtonModule, ModalModule } from './router';
export { loadHandlers } from './loader';
