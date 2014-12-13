if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    if(!str || str == ''){
      return false
    }
    return this.slice(0, str.length) == str;
  };
}

if (typeof Array.prototype.last != 'function') {
  Array.prototype.last = function() {
    return this[this.length - 1];
  };
}

(function(global, $, undefined){
  var console = global.console;

  function LinkSelector() {
    this.search_mode = false;
    this.search_word = '';
    this.search_word_histories = [];
    this.d = null;
    this.links = null;
    this.incremental_search = true;
    this.clear_search_word_when_switching = true;
    this.selected_link = null;
    this.matched_style = {backgroundColor: '#ff0000', opacity: 0.5};
    this.selected_style = {backgroundColor: '#0000ff', opacity: 0.5};
    this.debug = true;

    this.init();
  };

  LinkSelector.prototype.init = function(){
    // position: absolute で色を付けるやつ
    this.d = $('<span />')
        .addClass('link-caret')
        .css({
          position: 'absolute',
          top: '0px',
          left: '0px',
          width: '100%',
          height: '100%'
        })
        .css(this.matched_style);

    // aタグの中に入れるだけのやつ
    var link_inner_wrapper = $('<span class="link-inner-wrapper" style="position: relative;" />');

    var me = this;
    $('a').each(function(){
      // TODO リンクじゃないaタグは除外する
      var a = $(this);
      var inner = link_inner_wrapper.clone(false)
          .attr('data-url', a.attr('href'))
          .attr('data-selected', false)
          .attr('data-matched', false);
      $(this).wrapInner(inner);
    });

    me.links = $('.link-inner-wrapper');

    var body = $('body');
    me.search_box = $('<div id="search-word-wrapper" />')
        .css({
          display: 'none',
          position: 'fixed',
          top: '0px',
          left: '0px',
          width: '200px',
          height: '30px',
          border: '1px solid rgba(0, 0, 0, .5)',
          opacity: 0.5
        });

    body.prepend(me.search_box);

    body.on('keypress', function(e, backspace){
      if(me.search_mode){
        e.preventDefault();
        e.stopPropagation();
      }

      console.log(e.keyCode);
      switch (e.keyCode){
        case 47: // slash
          me.switch();
          break;
        case 13: // enter
          me.search();
          break;
        case 32: // space
          me.go();
          break;
        default:
          me.input(e.keyCode, backspace);
          break;
      }

      if(me.search_mode){
        return false
      }else{
        return true
      }
    }).on('keydown', function(e) {
      if(e.keyCode == 8 && me.search_mode) {
        e.preventDefault();
        e.stopPropagation();

        $(this).trigger('keypress', [true]);

        return false
      }else{
        return true
      }
    });
  };

  LinkSelector.prototype.switch = function(){
    this.search_mode = !this.search_mode;
    this.clear_search_result();
    if(this.clear_search_word_when_switching){
      this.search_word = '';
    }

    if(this.search_mode && this.incremental_search){
      this.search();
      this.update();
    }else{
      this.update();
    }

    if(this.debug) this.print('switch');
  };

  LinkSelector.prototype.clear_search_result = function(){
    this.selected_link = null;
    this.links.data('selected', false);
    this.links.data('matched', false);
    this.links.data('matched-index', null);
  };

  LinkSelector.prototype.search = function(){
    if(!this.search_mode) {
      return
    }

    var me = this;
    if(me.search_word &&
        me.search_word == me.search_word_histories.last() && me.selected_link){
      this.move_caret_to_next();
    }else{
      me.clear_search_result();
      me.search_word_histories.push(me.search_word);

      var matched_index = 0;
      me.links.each(function(){
        var link = $(this);

        // TODO 小文字にして保持した方がよい
        if(link.text().toLowerCase().startsWith(me.search_word.toLowerCase())) {
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
  };

  LinkSelector.prototype.move_caret_to_next = function(){
    var matched_index = this.selected_link.data('matched-index');
    var next = this.links.filter(function(){ return $(this).data('matched-index') == matched_index + 1 });

    if(next.length == 1){
      this.selected_link.data('selected', false);
      next.data('selected', true);
      this.selected_link = next;
    }else{
      var first = this.links.filter(function(){ return $(this).data('matched-index') == 0 });
      if(first.length == 1){
        this.selected_link.data('selected', false);
        first.data('selected', true);
        this.selected_link = first;
      }
    }
  };

  LinkSelector.prototype.go = function(){
    if(this.selected_link){
      global.location.href = this.selected_link.data('url');
    }
  };

  LinkSelector.prototype.input = function(key_code, backspace){
    if(!this.search_mode) {
      return
    }

    if(backspace){
      this.search_word = this.search_word.substring(0, this.search_word.length - 1);
      this.update_search_box();
      if(this.incremental_search){
        this.search();
      }
      return
    }

    // i18n対応
    var key = String.fromCharCode(key_code);
    if(!key.match(/\w/)){
      return
    }

    this.search_word += key;
    this.update_search_box();
    if(this.incremental_search){
      this.search();
    }

    if(this.debug) this.print('input');
  };

  LinkSelector.prototype.update = function(){
    this.update_search_box();
    this.update_link_caret();
  };

  LinkSelector.prototype.update_search_box = function(){
    if(!this.search_mode){
      this.search_box.css('display', 'none');
    }else{
      this.search_box.css('display', 'block');
    }

    this.search_box.text(this.search_word);
  };

  LinkSelector.prototype.update_link_caret = function(){
    var me = this;
    me.links.each(function(i){
      var link = $(this);
      link
          .find('.link-caret')
          .remove();

      if(link.data('matched')) {
        link.append(me.d.clone(false));
      }
    });

    if(me.selected_link){
      console.log('selected', me.selected_link);
      me.selected_link.find('.link-caret').css(me.selected_style);
    }
  };

  LinkSelector.prototype.print = function(name){
    console.log(name, this);
  };

  var app = new LinkSelector();
  global['app'] = app;

})(window, jQuery);
