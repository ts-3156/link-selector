if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    if(!str || str == ''){
      return false
    }
    return this.slice(0, str.length) == str;
  };
}

if (typeof Array.prototype.first != 'function') {
  Array.prototype.first = function() {
    return this[0];
  };
}

if (typeof Array.prototype.last != 'function') {
  Array.prototype.last = function() {
    return this[this.length - 1];
  };
}

if (typeof jQuery.fn.exists != 'function') {
  jQuery.fn.exists = function() {
    return this.length
  };
}

(function(global, $, undefined){
  var console = global.console;
  var clearInterval = global.clearInterval;
  var setInterval = global.setInterval;

  function SearchBox(parent) {
    this.parent = parent;
    this.element = null;
    this.search_mode = false;
    this.search_word = '';
    this.before_search_word = '';
    this.search_word_histories = [];
    this.clear_search_word_when_switching = false;
    this.select_all_when_empty_search_word = false;

    this.init();
  };

  SearchBox.prototype.init = function(){
    var body = $('body');
    this.element = $('<input class="search-box" type="text" />');

    body.prepend(this.element);
  };

  SearchBox.prototype.text = function(){
    return this.element.val();
  };

  SearchBox.prototype.on = function(name, fn){
    this.element.on(name, fn);
  };

  SearchBox.prototype.switch = function(){
    this.search_mode = !this.search_mode;
    if(this.clear_search_word_when_switching){
      this.search_word = '';
    }

    this.focusout();

    var me = this;
    this.parent.mode_switched(function(){
      if(me.search_mode){
        me.focus();
      }
    });
  };

  SearchBox.prototype.input = function(){
    if(!this.search_mode) {
      return
    }

    this.before_search_word = this.search_word;
    this.search_word = this.text();
    if(this.text_changed()){
      this.parent.text_changed();
    }
  };

  SearchBox.prototype.text_changed = function(){
    return this.before_search_word != this.search_word
  };

  SearchBox.prototype.search_word_changed = function(){
    return this.search_word != null &&
        this.search_word != this.search_word_histories.last()
  };

  SearchBox.prototype.search_word_matched = function(str){
    // TODO 小文字にして持っといた方がいいかも
    // TODO 前方一致以外のマッチ
    if(this.select_all_when_empty_search_word && this.search_word == ''){
      return true
    }

    if(this.search_word == null || this.search_word == '' ||
        str == null || str == ''){
      return false
    }

    return str.toLowerCase().startsWith(this.search_word.toLowerCase())
  };

  SearchBox.prototype.focus = function(){
    this.element.focus();
  };

  SearchBox.prototype.focusout = function(){
    this.element.focusout();
  };

  SearchBox.prototype.push_new_search_history = function(){
    this.search_word_histories.push(this.search_word);
  };

  SearchBox.prototype.update = function(){
    if(!this.search_mode){
      this.element.css('display', 'none');
    }else{
      this.element.css('display', 'block');
    }
  };

  function LinkSelector() {
    this.matched_link_style_layer = null;
    this.links = null;
    this.matched_links = null;
    this.selected_link = null;
    this.input_timer_id = null;
    this.incremental_search = true;
    this.input_observe_interval = 300;
    this.scroll_top_offset = -100;
    this.debug = true;

    this.init();
  };

  LinkSelector.prototype.init = function(){
    // position: absolute で色を付けるやつ
    this.matched_link_style_layer = $('<div />')
        .addClass('matched-link-style-layer')
        .addClass('matched');

    // aタグの中に入れるだけのやつ
    var link_inner_wrapper = $('<div class="link-inner-wrapper" style="position: relative;" />');

    var me = this;
    $('a').each(function(){
      // TODO リンクじゃないaタグは除外する
      var a = $(this);
      var wrapper = link_inner_wrapper.clone(false)
          .attr('data-url', a.attr('href'));
      $(this).wrapInner(wrapper);
    });

    me.links = $('.link-inner-wrapper');

    me.search_box = new SearchBox(this);
    me.bind_key_event();
  };

  LinkSelector.prototype.bind_key_event = function(){
    var me = this;
    var shifted = false;

    $('body').on('keypress', function(e){
      var snapped = false;
      console.log('key', e.keyCode);
      switch (e.keyCode){
        case 47: // slash
          me.search_box.switch();
          snapped = true;
          break;
        case 13: // enter
          me.search(shifted);
          snapped = true;
          break;
        case 32: // space
          me.go();
          snapped = true;
          break;
      }

      if(me.search_box.search_mode && snapped){
        return false
      }else{
        return true
      }
    }).on('keydown', function(e) {
      if(e.keyCode == 16){ // shift
        shifted = true;
      }

      if(e.keyCode == 27){ // esc
        me.search_box.switch();
      }

      return true
    }).on('keyup', function(e){
      if(e.keyCode == 16){ // shift
        shifted = false;
      }
    });

    me.search_box.on('input', function(){
      me.observe_input();
      return true
    });
  };

  LinkSelector.prototype.observe_input = function(){
    var me = this;

    if(me.input_timer_id){
      me.unobserve_input();
    }

    var loop_num = 0;
    me.input_timer_id = setInterval(function () {
      me.search_box.input();
      loop_num++;

      // 1 minute
      if(loop_num > 1000 / me.input_observe_interval * 60) {
        me.unobserve_input();
      }
    }, me.input_observe_interval);
  };

  LinkSelector.prototype.unobserve_input = function(){
    if(!this.input_timer_id){
      return
    }

    clearInterval(this.input_timer_id);
    this.input_timer_id = null;
  };

  LinkSelector.prototype.clear_search_result = function(){
    this.selected_link = null;
    this.matched_links = null;
    this.links.data('matched', false);
    this.links.data('selected', false);
    this.links.removeClass('matched');
    this.links.removeClass('selected');
  };

  LinkSelector.prototype.search = function(reverse){
    var me = this;
    var search_box = me.search_box;

    if(!search_box.search_mode) {
      return
    }

    if(!search_box.search_word_changed() && me.selected_link && me.selected_link.exists()){
      if(reverse){
        this.move_caret_to_prev();
      }else{
        this.move_caret_to_next();
      }
    }else{
      me.clear_search_result();
      search_box.push_new_search_history();

      me.links.filter(function(){
        return search_box.search_word_matched($(this).text())
      }).addClass('matched');

      me.matched_links = me.links.filter('.matched');
      me.selected_link = $(me.matched_links.first()).addClass('selected');
    }

    me.update_link_caret();
    me.scroll_to_caret();
  };

  LinkSelector.prototype.move_caret_to_prev = function(){
    var a = this.matched_links;
    var index = (a.index(this.selected_link) - 1 + a.length) % a.length;
    this._swap(index);
  };

  LinkSelector.prototype.move_caret_to_next = function(){
    var index = (this.matched_links.index(this.selected_link) + 1) % this.matched_links.length;
    this._swap(index);
  };

  LinkSelector.prototype._swap = function(new_index){
    var next = $(this.matched_links[new_index]);
    this.selected_link.removeClass('selected');
    next.addClass('selected');
    this.selected_link = next;
  };

  LinkSelector.prototype.scroll_to_caret = function(){
    if(this.selected_link && this.selected_link.exists()){
      var top = this.selected_link.offset().top;
      $('body').animate({ scrollTop: top + this.scroll_top_offset }, 'fast');
    }
  };

  LinkSelector.prototype.go = function(){
    if(this.selected_link){
      var url = this.selected_link.data('url');
      if(url){
        global.location.href = url;
      }
    }
  };

  LinkSelector.prototype.update = function(){
    this.search_box.update();
    this.update_link_caret();
  };

  LinkSelector.prototype.update_link_caret = function(){
    var me = this;
    me.links.each(function(i){
      var link = $(this);
      link
          .find('.matched-link-style-layer')
          .remove();

      if(link.hasClass('matched')) {
        link.append(me.matched_link_style_layer.clone(false));
      }
    });

    if(me.selected_link && me.selected_link.exists()){
      me.selected_link.find('.matched-link-style-layer')
          .addClass('selected');
    }
  };

  LinkSelector.prototype.mode_switched = function(callback_fn){
    this.clear_search_result();
    if(this.search_box.search_mode && this.incremental_search){
      this.search();
      this.update();
    }else{
      this.update();
    }

    if (typeof callback_fn == 'function') {
      callback_fn();
    }
  };

  LinkSelector.prototype.text_changed = function(){
    if(this.incremental_search){
      this.search();
    }
  };

  new LinkSelector();

})(window, jQuery);
