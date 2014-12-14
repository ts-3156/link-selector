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
    this.incremental_search = true;
    this.clear_search_word_when_switching = false;

    this.init();
  };

  SearchBox.prototype.init = function(){
    var body = $('body');
    this.element = $('<input />')
        .css({
          type: 'text',
          display: 'none',
          position: 'fixed',
          top: '0px',
          left: '0px',
          width: '200px',
          height: '30px',
          border: '1px solid rgba(0, 0, 0, .5)',
          opacity: 0.5
        });

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
    this.parent.clear_search_result();
    if(this.clear_search_word_when_switching){
      this.search_word = '';
    }

    this.focusout();

    if(this.search_mode && this.incremental_search){
      this.parent.search();
      this.parent.update();
    }else{
      this.parent.update();
    }

    if(this.search_mode){
      this.focus();
    }
  };

  SearchBox.prototype.input = function(){
    if(!this.search_mode) {
      return
    }

    this.before_search_word = this.search_word;
    this.search_word = this.text();
    if(this.text_changed() && this.incremental_search){
      this.parent.search();
    }
  };

  SearchBox.prototype.text_changed = function(){
    return this.before_search_word != this.search_word
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
    this.matched_link_wrapper = null;
    this.links = null;
    this.selected_link = null;
    this.matched_style = {backgroundColor: '#ff0000', opacity: 0.5};
    this.selected_style = {backgroundColor: '#0000ff', opacity: 0.5};
    this.input_timer_id = null;
    this.debug = true;

    this.init();
  };

  LinkSelector.prototype.init = function(){
    // position: absolute で色を付けるやつ
    this.matched_link_wrapper = $('<span />')
        .addClass('matched-link-wrapper')
        .css({
          position: 'absolute',
          top: '0px',
          left: '0px',
          width: '100%',
          height: '100%'
        })
        .css(this.matched_style);

    // aタグの中に入れるだけのやつ
    var link_inner_wrapper = $('<span class="link-inner-wrapper" style="position: relative;" />')
        .attr('data-selected', false)
        .attr('data-matched', false);

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

      // 2 * 60 == 1 minute
      if(loop_num > 2 * 60) {
        me.unobserve_input();
      }
    }, 500);
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
    this.links.data('selected', false);
    this.links.data('matched', false);
    this.links.data('matched-index', null);
  };

  LinkSelector.prototype.search = function(reverse){
    var me = this;
    var search_box = me.search_box;

    if(!search_box.search_mode) {
      return
    }

    if(search_box.search_word &&
        search_box.search_word == search_box.search_word_histories.last() && me.selected_link){
      if(reverse){
        this.move_caret_to_prev();
      }else{
        this.move_caret_to_next();
      }
    }else{
      me.clear_search_result();
      search_box.push_new_search_history();

      var matched_index = 0;
      me.links.each(function(){
        var link = $(this);

        // TODO filterを使えば matched_index が不要になる
        // TODO 小文字にして保持した方がよい
        if(link.text().toLowerCase().startsWith(search_box.search_word.toLowerCase())) {
          link.data('matched', true);
          link.data('matched-index', matched_index++);

          if(!me.selected_link){
            link.data('selected', true);
            me.selected_link = link;
          }
        }
      });
    }

    me.update_link_caret();
    me.scroll_to_caret();
  };

  LinkSelector.prototype.move_caret_to_prev = function(){
    this._move_caret_to(-1, 'last');
  };

  LinkSelector.prototype.move_caret_to_next = function(){
    this._move_caret_to(1, 'first');
  };

  LinkSelector.prototype._move_caret_to = function(diff, fn_name){
    var matched_index = this.selected_link.data('matched-index');
    var matched_links = this.links.filter(function(){
      return $(this).data('matched-index') != null
    });

    var index = matched_index + diff;
    if(index < 0){
      index = matched_links.length - 1;
    }else if(index >= matched_links.length){
      index = 0
    }

    var next = $(matched_links[index]);

    this.selected_link.data('selected', false);
    next.data('selected', true);
    this.selected_link = next;
  };

  LinkSelector.prototype.scroll_to_caret = function(){
    if(this.selected_link){
      var top = this.selected_link.offset().top;
      $('body').animate({ scrollTop: top }, 'fast');
    }
  };

  LinkSelector.prototype.go = function(){
    if(this.selected_link){
      global.location.href = this.selected_link.data('url');
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
          .find('.matched-link-wrapper')
          .remove();

      if(link.data('matched')) {
        link.append(me.matched_link_wrapper.clone(false));
      }
    });

    if(me.selected_link){
      console.log('selected', me.selected_link);
      me.selected_link.find('.matched-link-wrapper').css(me.selected_style);
    }
  };

  LinkSelector.prototype.print = function(name){
    console.log(name, this);
  };

  var app = new LinkSelector();

})(window, jQuery);
