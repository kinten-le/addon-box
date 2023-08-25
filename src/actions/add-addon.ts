import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import AddAddonUrl from '../dialogs/add-addon-url.js';
import { BackendPortal } from '../api.js';

export default function AddAddonAction(
{ parent_window,
}:
{ parent_window: Gtk.Window;
}) {
  const actions: Gio.SimpleAction[] = [];
  const workshop = BackendPortal({
    interface_name: 'com.github.kinten108101.SteamVPK.Server.Workshop',
  });

  const add_from_url = new Gio.SimpleAction({
    name: 'add-addon.add-url',
  });
  add_from_url.connect('activate', () => {
    const window = new AddAddonUrl({
      transient_for: parent_window,
    });
    const cache: Map<string, any> = new Map;
    window.connect_signal('validate', async (_window, request_error, url) => {
      let response: [number, any];
      try {
        response = await workshop.async_call(
          'GetPublishedFileDetails', url);
      } catch (error) {
        request_error(`${error}`);
        return false;
      }
      const [status, data] = response;
      if (status !== 0) {
        request_error(`Server error`);
        return false;
      }
      console.log('success');
      cache.set(url, data);
      return true;
    });
    window.connect_signal('preview-page::setup', async (_window, url, page) => {
      const data = cache.get(url);
      if (data === undefined) return false;
      page.name_request = data['title'] || 'Untitled add-on';
      page.creator_request = data['creator'] || 'Unknown creator';
      page.excerpt_request = data['description'] || 'Unknown description';
      page.size_request = data['file_size'] || 0;
      return true;
    });
    window.show();
  });
  actions.push(add_from_url);

  function export2actionmap(action_map: Gio.ActionMap) {
    actions.forEach(x => {
      action_map.add_action(x);
    });
  }

  const services = {
    export2actionmap,
  };

  return services;
}
