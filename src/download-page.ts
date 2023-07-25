import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import { Config } from './config.js';
import { gobjectClass } from './utils/decorator.js';
import { MainWindowContext } from './window.js';
import { Addon } from './addons.js';
import { LateBindee } from './mvc.js';
import * as Markup from './markup.js';
import { AddonStorage } from './addon-storage.js';
import * as Utils from './utils.js';

export enum UseStates {
  USED = 'used',
  AVAILABLE = 'available',
};

//const UseStatesArr = Object.keys(UseStates).map(x => x);

class UseButton extends Gtk.Button {
  static {
    GObject.registerClass({
      GTypeName: 'StvpkUseButton',
      Properties: {
        state: GObject.ParamSpec.string('state', 'state', 'Enum for the state of StvpkUseButton, see `Stvpk.UseButton.States`.', Utils.g_param_default, UseStates.AVAILABLE),
      }
    }, this);
  }

  state!: string;

  constructor(param = {}) {
    super(param);
    this.set_valign(Gtk.Align.CENTER);
    this.set_halign(Gtk.Align.CENTER);
    this.connect('notify::state', this.updateState);
  }

  updateState = (button: UseButton) => {
    const state = button.state;
    switch (state) {
    case UseStates.USED:
      this.set_label('Used');
      this.remove_css_class('suggested-action');
      this.set_sensitive(false);
      break;
    case UseStates.AVAILABLE:
      this.set_label('Use');
      this.add_css_class('suggested-action');
      this.set_sensitive(true);
      break;
    default:
      throw new Error(`Unexpected UseButton.States. Details: ${state}`);
    }
  }
}

class DownloadPageRowItem extends GObject.Object {
  static {
    Utils.registerClass({
      Properties: {
        origin: GObject.ParamSpec.object('origin', 'origin', 'origin', Utils.g_param_default, Addon.$gtype),
        name: GObject.ParamSpec.string('name', 'name', 'name', Utils.g_param_default, null),
        creator: GObject.ParamSpec.string('creator', 'creator', 'creator', Utils.g_param_default, null),
        description: GObject.ParamSpec.string('description', 'description', 'description', Utils.g_param_default, 'lol'),
        'use-state': GObject.ParamSpec.string('use-state', 'use-state', 'use-state', Utils.g_param_default, UseStates.AVAILABLE),
        'id-gvariant': GObject.param_spec_variant('id-gvariant', 'id-gvariant', 'id-gvariant', GLib.VariantType.new('s'), GLib.Variant.new_string('default'), Utils.g_param_default),
      }
    }, this);
  }

  origin!: Addon;
  name!: string;
  creator!: string;
  description!: string;
  use_state!: UseStates;
  id_gvariant!: GLib.Variant;

  constructor(param: { addon: Addon }) {
    super({});
    this.origin = param.addon;
    this.name = this.origin.title || '';
    this.creator = (() => {
                const creators: string[] = [];
                this.origin.creators?.forEach((_, key) => creators.push(key));
                if (creators.length === 0) return 'Unknown author';
                const text: string = creators.reduce((acc, x, i) => {
                  if (i === 0) return `${x}`;
                  return `${acc}, ${x}`;
                });
                return text;
              })();
    this.description = Markup.MakeCompatPango(this.origin.description || '');
    //this.use_state = UseStates.AVAILABLE;
    console.log('ID is', Utils.g_variant_unpack<string>(this.id_gvariant, 'string'));
    this.id_gvariant = GLib.Variant.new_string(this.origin.vanityId);

  }

  set_use_state(val: UseStates) {
    //if (val === this.use_state) return;
    this.use_state = val;
  }
}

@gobjectClass({
  Template: `resource://${Config.config.app_rdnn}/ui/download-page-row.ui`,
  Properties: {
    'item': GObject.ParamSpec.object('item', 'item', 'item', Utils.g_param_default, DownloadPageRowItem.$gtype),
  },
  Children: [ 'title', 'subtitle', 'description', 'use_button', 'trash' ],
})
export class DownloadPageRow extends Gtk.ListBoxRow {
  item!: DownloadPageRowItem;
  title!: Gtk.Label;
  subtitle!: Gtk.Label;
  description!: Gtk.Label;
  use_button!: UseButton;
  trash!: Gtk.Button;

  constructor(param: { item: DownloadPageRowItem }) {
    const { item, ..._param } = param;
    super(_param);
    this.item = param.item;

    const flags = GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE;
    (<[string, Gtk.Widget, string][]>[
      ['name', this.title, 'label'],
      ['creator', this.subtitle, 'label'],
      ['description', this.description, 'label'],
      ['use-state', this.use_button, 'state'],
    ]).forEach(([prop, child, child_prop]) => {
      this.item.bind_property(prop, child, child_prop, flags);
    })


    /*
    this.title.bind_property('label', this.item, 'name', flags);
    this.subtitle.bind_property('label', this.item, 'creator', flags);
    this.description.bind_property('label', this.item, 'description', flags);
    this.use_button.bind_property('state', this.item, 'use-state', flags);
    */
  }
}


@gobjectClass({
  Template: `resource://${Config.config.app_rdnn}/ui/download-page.ui`,
  Children: [
    'localRepoList',
    'localRepoSection',
    'remoteRepoList',
    'remoteRepoSection',
    'builder-entry',
  ] })
export class DownloadPage extends Adw.PreferencesPage
implements LateBindee<MainWindowContext> {
  localRepoSection!: Adw.PreferencesGroup;
  localRepoList!: Gtk.ListBox;
  localRepoModel: Gio.ListStore<DownloadPageRowItem>;

  remoteRepoSection!: Adw.PreferencesGroup;
  remoteRepoList!: Gtk.ListBox;
  remoteRepoModel: Gio.ListStore<DownloadPageRowItem>;

  repoModel: Gtk.FlattenListModel;

  addonStorage!: AddonStorage;
  context!: MainWindowContext;

  builder_entry!: Adw.Bin;

  constructor(param = {}) {
    super(param);
    this.localRepoModel = new Gio.ListStore({ item_type: DownloadPageRowItem.$gtype });
    this.remoteRepoModel = new Gio.ListStore({ item_type: DownloadPageRowItem.$gtype });
    this.localRepoList.bind_model(this.localRepoModel, this.widgetCreator);
    this.remoteRepoList.bind_model(this.remoteRepoModel, this.widgetCreator);
    // does item type have to be consistent?
    this.repoModel = new Gtk.FlattenListModel({
      model: (() => {
        const model = new Gio.ListStore<Gio.ListStore<DownloadPageRowItem>>({ item_type: Gio.ListStore.$gtype });
        model.append(this.localRepoModel);
        model.append(this.remoteRepoModel);
        return model;
      })(),
    });
  }

  #updateUse = () => {
    Utils.g_model_foreach<DownloadPageRowItem>(this.repoModel, (item) => {
      if (this.addonStorage.loadorder.includes(item.origin.vanityId)) {
        item.set_use_state(UseStates.USED);
      } else {
        item.set_use_state(UseStates.AVAILABLE);
      }
    });
  }

  onBind(context: MainWindowContext) {
    this.context = context;
    this.addonStorage = context.application.addonStorage;
    context.application.addonStorage.connect(AddonStorage.Signals.addons_changed, this.updateLayout);
    this.updateLayout();
    context.application.addonStorage.connect(AddonStorage.Signals.loadorder_changed, this.#updateUse);
    this.#updateUse();
  }

  widgetCreator = (x: GObject.Object): DownloadPageRow => {
    const item = x as DownloadPageRowItem;
    const row = new DownloadPageRow({ item });
    /*
    const id = GLib.Variant.new_string(addon.vanityId);
    row.use_button.set_action_target_value(id);
    // this will cause a memory leak?
    const update = () => {
      if (this.addonStorage.loadorder.includes(addon.vanityId)) {
        console.debug('Set use-button state as used!');
        row.use_button.set_state(UseButton.States.USED);
      } else {
        row.use_button.set_state(UseButton.States.AVAILABLE);
      }
    };
    update();
    this.addonStorage.connect(AddonStorage.Signals.loadorder_changed, update);
    this.context.main_window.connect(Window.Signals.first_flush, update);
    row.set_action_target_value(id);
    */
    return row;
  }

  updateLayout = () => {
    console.debug('<<updateLayout>>');
    console.debug('loadorder:', this.context.application.addonStorage.loadorder);
    this.localRepoModel.remove_all();
    this.remoteRepoModel.remove_all();
    this.addonStorage.idmap.forEach(x => {
      const item = new DownloadPageRowItem({ addon: x })
      if (x.steamId) {
        return this.remoteRepoModel.append(item);
      }
      return this.localRepoModel.append(item);
    })
    if (this.localRepoModel.get_n_items() === 0) this.localRepoSection.set_visible(false);
    else this.localRepoSection.set_visible(true);
    if (this.remoteRepoModel.get_n_items() === 0) this.remoteRepoSection.set_visible(false);
    else this.remoteRepoSection.set_visible(true);
    this.#updateUse();
  };
}
