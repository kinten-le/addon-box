import Gio from 'gi://Gio';

export default function SettingsDevelStylePresenter(
{ gsettings,
  enable_switch,
}:
{ gsettings: Gio.Settings;
  enable_switch: {
    get_active(): boolean;
    set_active(val: boolean): void;
  };
}) {
  function update_enable_devel_style() {
    let val: boolean;
    try {
      val = gsettings.get_boolean('enable-devel-style');
    } catch (error) {
      logError(error);
      return;
    }
    if (val !== enable_switch.get_active())
      enable_switch.set_active(val);
  }
  gsettings.connect('changed::enable-devel-style', () => {
    update_enable_devel_style();
  });
  update_enable_devel_style();
}
