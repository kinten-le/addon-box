import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { log_error, promise_wrap } from './steam-vpk-utils/utils.js';
import TypedBuilder from './typed-builder.js';
import { BackendPortal } from './api.js';
import { APP_RDNN } from './const.js';
import { Toast } from './toast-builder.js';
import { FieldRow } from './gtk.js';
import { BuilderData } from './addon-details-leaflet-page.js';
import { ArchiveListObj, ArchiveListRow } from './addon-details-archive-list.js';

export function get_from_response<T>(response: any, key: string, type: string) {
  const val = response[key];
  if (typeof val !== type) throw new Error(`Incorrect value type in response, expected ${type} from key \"${key}\"`);
  return val as T;
}

export function AddonDetailsPagePresenter(
{ toaster,
  builder_cont,
  action_map,
  leaflet,
  leaflet_page,
}:
{ toaster?: Adw.ToastOverlay;
  builder_cont?: TypedBuilder;
  action_map: Gio.ActionMap;
  leaflet: Adw.Leaflet;
  leaflet_page: string;
}) {
  const addon_service = BackendPortal({
    interface_name: 'com.github.kinten108101.SteamVPK.Server.Addons',
  });

  const workshop_service = BackendPortal({
    interface_name: 'com.github.kinten108101.SteamVPK.Server.Workshop',
  });

  const disk_service = BackendPortal({
    interface_name: 'com.github.kinten108101.SteamVPK.Server.Disk',
  });

  const builder = (() => {
    if (builder_cont) return builder_cont;
    const builder = new TypedBuilder();
    builder.add_from_resource(`${APP_RDNN}/ui/addon-details.ui`);
    return builder;
  })();

  let currentAddon: string | undefined;
  const cleanup_actions: Map<string, Function> = new Map;

  function reset() {
    cleanup_actions.forEach(x => x());
  }

  async function present(id: string) {
    reset();
    const addon: any = await addon_service
      .call_async('Get', '(a{sv})', id)
        .catch(error => {
          log_error(error);
        });
    if (addon === undefined) {
      console.warn(`Couldn\'t find add-on \"${id}\". Refuse to navigate. Quitting...`);
      toaster?.add_toast(
        Toast.builder()
        .title('Add-on data cannot be found!')
        .build());
      return;
    }
    console.log(addon);

    currentAddon = id;
    const id_gvariant = GLib.Variant.new_string(id);
    const isRemote = addon['publishedfileid'] !== undefined;
    const steamid = addon['publishedfileid'] || '';
    const data = builder.get_typed_object<BuilderData>('data');
    data.id = id_gvariant;

    /*
    const wintitle_full = builder.get_typed_object<Adw.WindowTitle>('wintitle-full');
    wintitle_full.set_title(get_from_response<string>(addon, 'title', 'string'));

    const headerbar_stack = builder.get_typed_object<Gtk.Stack>('headerbar-stack');
    const scroller = builder.get_typed_object<Gtk.ScrolledWindow>('scroller');
    const vadj = scroller.get_vadjustment();
    let show_full_prev = false;
    const use_vadj_value_changed = vadj.connect('value-changed', ($obj) => {
      const show_full = $obj.get_value() > 80;
      if (show_full_prev === show_full) return;
      if (show_full) {
        headerbar_stack.set_visible_child_name('full');
      } else {
        headerbar_stack.set_visible_child_name('flat');
      }
      show_full_prev = show_full;
    });
    cleanup_actions.set('disuse-vadj-value-changed', () => {
      vadj.disconnect(use_vadj_value_changed);
    });
    */

    const title = builder.get_typed_object<Gtk.Label>('title');
    if (addon.title) title.set_label(addon.title);
    const subtitle = builder.get_typed_object<Gtk.Label>('subtitle');
    if (addon.creators) {
      if (Array.isArray(addon.creators)) {
        // assume string elements
        let created_by = '';
        (addon.creators as Array<string>).forEach((x, i) => {
          if (typeof x !== 'object') return;
          if (!('id' in x)) return;
          if (typeof x['id'] !== 'string') return;
          if (i == 0) {
            created_by = x['id'];
            return;
          }
          created_by = created_by + ', ' + x['id'];
        });
        subtitle.set_label(created_by);
      }
    }

    disk_service.call_async(
      'GetAddonFolderSize',
      '(ts)',
      currentAddon
      ).then(([_size, size_text]) => {
          const used_label = builder.get_typed_object<Gtk.Label>('used');
          used_label.set_label((() => {
            if (size_text !== '')
              return `${size_text} Used`;
            return 'Unknown size';
          })());
        },
        error => {
         log_error(error);
       });

    const tags = builder.get_typed_object<Gtk.Box>('tags');
    const tag_empty = builder.get_typed_object<Gtk.Button>('tag-empty');
    addon_service
      .call_async('HasArchive', '(b)', currentAddon)
        .then(has => {
          if (!has) {
            tag_empty.set_visible(true);
          } else {
            tag_empty.set_visible(false);
          }
        })
        .catch(error => log_error(error))
        .finally(() => {
          if (tag_empty.get_visible()) {
            tags.set_visible(true);
          } else {
            tags.set_visible(false);
          }
        });

    const stvpkid = builder.get_typed_object<FieldRow>('stvpkid');
    stvpkid.set_value(id);
    data.id = GLib.Variant.new_string(id);

    const steamid_row = builder.get_typed_object<FieldRow>('steamid');
    data.steamid = GLib.Variant.new_string(steamid);
    const website_row = builder.get_typed_object<Adw.ActionRow>('visit-steam-row');

    data.subdir_uri = GLib.Variant.new_string(addon.subdir);

    if (isRemote) {
      steamid_row.set_value((() => {
        if (steamid)
          return steamid;
        return 'Unknown';
      })());
      steamid_row.set_visible(true);
      website_row.set_visible(true);
    } else {
      steamid_row.set_visible(false);
      website_row.set_visible(false);
    }

    workshop_service.call_async(
      'GetWorkshopUrl',
      '(s)',
      steamid)
        .then((url: string) => {
          website_row.set_subtitle(url);
          data.steam_url = GLib.Variant.new_string(url);
        },
        error => {
          console.warn(error);
        });

    const archive_model = new Gio.ListStore({ item_type: ArchiveListObj.$gtype });
    const archive_list = builder.get_typed_object<Gtk.ListBox>('archive-list');
    archive_list.bind_model(archive_model, (obj: GObject.Object) => {
      if (!(obj instanceof ArchiveListObj)) throw new Error;
      const widget = new ArchiveListRow();
      const flags = GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL;
      obj.bind_property('name', widget['title'], 'label', flags);
      return widget;
    });
    if (addon['archive_group'] && Array.isArray(addon['archive_group'])) {
      for (const archive of addon['archive_group']) {
        const obj = new ArchiveListObj();
        if ('path' in archive && typeof archive['path'] === 'string') {
          // FIXME(kinten): Regex works
          const file = Gio.File.new_for_path(archive['path']);
          const name = file.get_basename();
          if (name === null) return;
          obj['name'] = name;
        }
        archive_model.append(obj);
      }
    }

    // end
    leaflet.set_visible_child_name(leaflet_page);
  }

  addon_service.subscribe('AddonsChangedAfter', (_list: any[]) => {
    promise_wrap(async () => {
      if (currentAddon === undefined) {
        return;
      }
      if (await addon_service.call_async('Has', '(b)', currentAddon)) {
        return;
      }
      const back = action_map.lookup_action('back');
      if (back === null) {
        return;
      }
      if (leaflet.get_visible_child_name() !== leaflet_page) {
        return;
      }
      back.activate(null);
    });
  });

  return present;
}
