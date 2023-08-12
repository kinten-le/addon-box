import Gtk from 'gi://Gtk';

export default function Shortcuts(
{ application,

}:
{ application: Gtk.Application;

}) {
  (<[string, string[]][]>
  [
    ['app.quit', ['<Control>q']],
    ['app.new-window', ['<Control>n']],
    ['win.back', ['<Alt>Left']],
    ['win.forward', ['<Alt>Right']],
    ['win.close', ['<Control>w']],
    ['win.show-preferences', ['<Control>comma']],
    ['win.stack.page-backward', ['<Shift>Left']],
    ['win.stack.page-forward', ['<Shift>Right']],
  ]).forEach(([action, accels]) => {
    application.set_accels_for_action(action, accels);
  });
}