import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import './addons-panel.js';

import {
  GtkChildren,
  GtkTemplate,
  param_spec_boolean,
  param_spec_object,
  param_spec_string,
  param_spec_variant,
  registerClass,
} from './steam-vpk-utils/utils.js';
import { APP_RDNN } from './const.js';

export enum UseStates {
  USED = 'used',
  AVAILABLE = 'available',
};

export class UseButton extends Gtk.Button {
  static [GObject.properties] = {
    state: param_spec_string({
      name: 'state',
      default_value: UseStates.AVAILABLE,
    }),
  };

  static {
    registerClass({}, this);
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
      this.set_label('Added');
      this.remove_css_class('suggested-action');
      this.set_sensitive(false);
      break;
    case UseStates.AVAILABLE:
      this.set_label('Add');
      this.add_css_class('suggested-action');
      this.set_sensitive(true);
      break;
    default:
      throw new Error(`Unexpected UseButton.States. Details: ${state}`);
    }
  }
}

export class RepositoryItem extends GObject.Object {
  static [GObject.properties] = {
    isRemote: param_spec_boolean({
      name: 'is_remote',
    }),
    name: param_spec_string({
      name: 'name',
    }),
    creator: param_spec_string({
      name: 'creator',
    }),
    description: param_spec_string({
      name: 'description',
    }),
    use_state: param_spec_string({
      name: 'use-state',
      default_value: UseStates.AVAILABLE,
    }),
    id_gvariant: param_spec_variant({
      name: 'id-gvariant',
      type: GLib.VariantType.new('s'),
      default_value: GLib.Variant.new_string('default id'),
    }),
    id: param_spec_string({
      name: 'id',
    }),
  };

  static {
    registerClass({}, this);
  }

  is_remote!: boolean;
  name!: string;
  creator!: string;
  description!: string;
  use_state!: UseStates;
  id!: string;
  id_gvariant!: GLib.Variant;

  constructor(params: {
    is_remote: boolean;
    name: string;
    creator: string;
    id: string;
  }) {
    super(params);
    this.id_gvariant = GLib.Variant.new_string(params.id);
  }

  set_use_state(val: UseStates) {
    //if (val === this.use_state) return;
    this.use_state = val;
  }
}

export class DownloadPageRow extends Gtk.ListBoxRow {
  static [GObject.properties] = {
    id_gvariant: param_spec_variant({
      name: 'id-gvariant',
      type: GLib.VariantType.new('s'),
    }),
  }
  static [GtkTemplate] = `resource://${APP_RDNN}/ui/download-page-row.ui`;
  static [GtkChildren] = [ 'title', 'subtitle', 'description', 'use_button', 'trash' ];
  static {
    registerClass({}, this);
  }
  title!: Gtk.Label;
  subtitle!: Gtk.Label;
  description!: Gtk.Label;
  use_button!: UseButton;
  trash!: Gtk.Button;
}

export class RepositoryListStore extends Gtk.FlattenListModel {
  static {
    registerClass({}, this);
  }

  constructor() {
    super({
      model: (() => {
        const local_addons = new Gio.ListStore({ item_type: RepositoryItem.$gtype });
        const remote_addons = new Gio.ListStore({ item_type: RepositoryItem.$gtype });
        const model = new Gio.ListStore({ item_type: Gio.ListStore.$gtype });
        model.append(local_addons);
        model.append(remote_addons);
        return model;
      })(),
    });
    RepositoryItem;
  }

  get local_addons(): Gio.ListStore<RepositoryItem> {
    const model = this.model.get_item(0);
    if (model === null) throw new Error;
    return model as Gio.ListStore;
  }

  get remote_addons(): Gio.ListStore<RepositoryItem> {
    const model = this.model.get_item(1);
    if (model === null) throw new Error;
    return model as Gio.ListStore;
  }

  append() {

  }

  refill(items: RepositoryItem[]) {
    this.local_addons.remove_all();
    this.remote_addons.remove_all();
    items.forEach(x => {
      if (x.is_remote) this.remote_addons.append(x);
      else this.local_addons.append(x);
    })
  }
}

export class DownloadPage extends Adw.PreferencesPage {
  static [GObject.properties] = {
    addons: param_spec_object({ name: 'addons', objectType: RepositoryListStore.$gtype }),
  }
  static [GtkTemplate] = `resource://${APP_RDNN}/ui/download-page.ui`;
  static [GtkChildren] = [ 'local_addons', 'remote_addons', 'local_group', 'remote_group' ];
  static {
    registerClass({}, this);
  };

  addons: RepositoryListStore;
  local_addons!: Gtk.ListBox;
  remote_addons!: Gtk.ListBox;
  local_group!: Adw.PreferencesGroup;
  remote_group!: Adw.PreferencesGroup;

  constructor(params = {}) {
    super(params);
    this.addons = new RepositoryListStore();
    // NOTE(kinten): For GtkNoSelection, use the constructor with { model } param, DO NOT use the constructor with positional param (did not work).
    (<[Gtk.ListBox, Gio.ListModel, Adw.PreferencesGroup][]>
    [
      [this.local_addons, this.addons.local_addons, this.local_group],
      [this.remote_addons, this.addons.remote_addons, this.remote_group],
    ]).forEach(([list, model, group]) => {
      list.bind_model(model, (item: GObject.Object) => {
        const widget = new DownloadPageRow();
        const flags = GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE;
        (<[string, Gtk.Widget, string][]>[
          ['name', widget.title, 'label'],
          ['creator', widget.subtitle, 'label'],
          ['use-state', widget.use_button, 'state'],
          ['id-gvariant', widget, 'id_gvariant'],
        ]).forEach(([prop, child, child_prop]) => {
          item.bind_property(prop, child, child_prop, flags);
        });
        return widget;
      });
      model.connect('notify::n-items', update_group_with_list.bind(null, model, group));
      update_group_with_list(model, group);
    });

  }
}

function update_group_with_list(model: Gio.ListModel, group: Adw.PreferencesGroup) {
  if (model.get_n_items() === 0) {
    group.set_visible(false);
  } else {
    group.set_visible(true);
  }
}
