(function(jqchat, desktopNotification, ChatRoom, TAFFY) {

  /**
   ##################                           ##################
   ##################                           ##################
   ##################   CHAT APPLICATION        ##################
   ##################                           ##################
   ##################                           ##################
   */

  /**
   * ChatApplication Class
   * @constructor
   */
  function ChatApplication() {
    //check if we're on the config mode or not
    this.configMode = false;
    this.isLoaded = false;
    this.portalURI = "";
    this.dbName = "";
    this.chatFullscreen = "false";

    this.chatRoom;
    this.room = "";
    this.rooms = "";
    this.username = "";
    this.fullname = "";
    this.targetUser = "";
    this.targetFullname = "";
    this.token = "";
    this.jzChatGetCreator = "";
    this.jzChatToggleFavorite = "";
    this.jzChatRead = "";
    this.jzChatSendMeetingNotes = "";
    this.jzChatGetMeetingNotes = "";
    this.jzMaintainSession = "";
    this.jzUpload = "";
    this.jzCreateEvent = "";
    this.jzSaveWiki = "";
    this.jzUsers = "";
    this.jzDeleteTeamRoom = "";
    this.jzSaveTeamRoom = "";
    this.userFilter = "";    //not set
    this.plfUserStatusUpdateUrl = "";
    this.chatIntervalSession = "";

    this.chatSessionInt = -1; //not set
    this.filterInt;

    this.isTeamAdmin = false;

    this.old = '';

    this.profileStatus = "offline";
    this.totalNotif = 0;
    this.oldNotif = 0;

    this.showFavorites = true;
    this.showPeople = true;
    this.showOffline = false;
    this.showSpaces = true;
    this.showTeams = true;

    this.showPeopleHistory = false;
    this.showSpacesHistory = false;
    this.showTeamsHistory = false;

    this.showRoomOfflinePeople = false;
    this.plugins = [];

    // If chatEvents object is configured before initializing Chat Application
    if (typeof chatEvents === 'object') {
      for (var i = 0; i < chatEvents.length; i++) {
        this.registerEvent(chatEvents[i]);
      }
    }
  }

  ChatApplication.prototype.setUserPref = function (key, value, expire) {
    jzStoreParam(key + this.username, value, expire);
  }

  ChatApplication.prototype.getUserPref = function (key) {
    return jzGetParam(key + this.username);
  }

  ChatApplication.prototype.registerEvent = function (plugin) {
    this.plugins.push(plugin);
  }

  ChatApplication.prototype.trigger = function (event, context) {
    jqchat.each(this.plugins, function (idx, plugin) {
      if (context.continueSend && plugin[event]) {
        plugin[event](context);
      }
    });
  }

  /**
   * Init Chat Interval
   */
  ChatApplication.prototype.initChat = function () {
    this.chatRoom = new ChatRoom(this.username, this.token, this.dbName, this.jzChatRead, this.jzChatSendMeetingNotes, this.jzChatGetMeetingNotes, jqchat("#chats"), this.portalURI);
    this.chatRoom.onRefresh(this.onRefreshCallback);
    this.chatRoom.onShowMessages(this.onShowMessagesCallback);

    var homeLinkHtml = jqchat("#HomeLink").html();
    homeLinkHtml = '<a href="#" class="btn-home-responsive"></a>' + homeLinkHtml;
    jqchat("#HomeLink").html(homeLinkHtml);

    jqchat(".btn-home-responsive").on("click", function () {
      var $leftNavigationTDContainer = jqchat(".LeftNavigationTDContainer");
      if ($leftNavigationTDContainer.css("display") === "none") {
        $leftNavigationTDContainer.animate({width: 'show', duration: 200});
      } else {
        $leftNavigationTDContainer.animate({width: 'hide', duration: 200});
      }
    });

    this.resize();
    jqchat(window).resize(function () {
      chatApplication.resize();
    });

    this.showFavorites = this.getUserPref("chatShowFavorites") === "false" ? false : true;
    this.showPeople = this.getUserPref("chatShowPeople") === "false" ? false : true;
    this.showOffline = this.getUserPref("chatShowOffline") === "true" ? true : false;
    this.showSpaces = this.getUserPref("chatShowSpaces") === "false" ? false : true;
    this.showTeams = this.getUserPref("chatShowTeams") === "false" ? false : true;

    var thiss = this;
    this.loadRooms(function () {
      var _room;

      /*
       Retrieving the info related to the destination room used when clicking on the Desktop Notification's popup to show the correct Room.
       */
      if (localStorage.getItem('notification.room') != null) {
        _room = localStorage.getItem('notification.room');
        localStorage.removeItem('notification.room');
      } else {
        _room = thiss.getUserPref("lastRoom");
      }

      if (_room) {
        thiss.room = _room;
        var TAFFYRoom = thiss.rooms({room: _room}).first();
        thiss.targetUser = TAFFYRoom.user;
        thiss.targetFullname = TAFFYRoom.fullName;
        thiss.loadRoom();
      }
    });

    setTimeout(jqchat.proxy(this.showSyncPanel, this), 1000);

    var $leftPanel = jqchat('#chat-users');

    $leftPanel.on("click", ".header-room", function () {
      if (jqchat(this).hasClass("header-favorites"))
        chatApplication.showFavorites = !chatApplication.showFavorites;
      else if (jqchat(this).hasClass("header-people"))
        chatApplication.showPeople = !chatApplication.showPeople;
      else if (jqchat(this).hasClass("header-spaces"))
        chatApplication.showSpaces = !chatApplication.showSpaces;
      else if (jqchat(this).hasClass("header-teams"))
        chatApplication.showTeams = !chatApplication.showTeams;

      chatApplication.setUserPref("chatShowFavorites", chatApplication.showFavorites, 600000);
      chatApplication.setUserPref("chatShowPeople", chatApplication.showPeople, 600000);
      chatApplication.setUserPref("chatShowSpaces", chatApplication.showSpaces, 600000);
      chatApplication.setUserPref("chatShowTeams", chatApplication.showTeams, 600000);

      chatApplication.renderRooms();
    });


    $leftPanel.on("click", ".btn-add-team", function (event) {
      event.stopPropagation();
      chatApplication.showTeams = true;
      chatApplication.setUserPref("chatShowTeams", chatApplication.showTeams, 600000);
      chatApplication.renderRooms();

      var $uitext = jqchat("#team-modal-name");
      $uitext.val("");
      $uitext.attr("data-id", "---");

      window.require(["SHARED/suggester"], function ($) {
        initTeamForm();

        $('#team-add-user')[0].selectize.clear();
      });

      showPopupWindow("team-modal-form", true);
      jqchat("#team-modal-form .popupTitle").text(chatBundleData['exoplatform.chat.team.add.title']);
      $uitext.focus();

      chatApplication.setModalToCenter('.team-modal');
    });

    $leftPanel.on("click", ".btn-history", function (event) {
      event.stopPropagation();
      var type = jqchat(this).attr("data-type");
      if (type === "people") {
        chatApplication.showPeople = true;
        chatApplication.showPeopleHistory = !chatApplication.showPeopleHistory;
        chatApplication.setUserPref("chatShowPeople", true, 600000);
      } else if (type === "space") {
        chatApplication.showSpaces = true;
        chatApplication.showSpacesHistory = !chatApplication.showSpacesHistory;
        chatApplication.setUserPref("chatShowSpaces", true, 600000);
      } else if (type === "team") {
        chatApplication.showTeams = true;
        chatApplication.showTeamsHistory = !chatApplication.showTeamsHistory;
        chatApplication.setUserPref("chatShowTeams", true, 600000);
      }
      chatApplication.renderRooms();

    });

    $leftPanel.on("click", ".btn-offline", function (event) {
      event.stopPropagation();
      chatApplication.showPeople = true;
      chatApplication.setUserPref("chatShowPeople", true, 600000);
      chatApplication.showOffline = !chatApplication.showOffline;
      chatApplication.setUserPref("chatShowOffline", chatApplication.showOffline, 600000);
      chatApplication.renderRooms();
    });

    var thiss = this;
    $leftPanel.on("click.selectRoom", ".users-online > td:nth-child(2)", function () {

      // Mobile view
      if (window.innerWidth <= 767) {

        jqchat("#chat-application .uiGrayLightBox .uiSearchInput").removeClass("displayContent");
        jqchat('input#chat-search.input-with-value.span4').val('');
        var filter = jqchat('input#chat-search.input-with-value.span4').val();
        chatApplication.search(filter);

        var $chatStatusPanel = jqchat(".chat-status-panel");

        $chatStatusPanel.css("display", "none");
        jqchat(" .chat-status-chat").parent().removeClass('active');

        jqchat(".uiLeftContainerArea").removeClass("displayContent");
        jqchat(".uiLeftContainerArea").addClass("hideContent");
        jqchat(".uiGlobalRoomsContainer").css("display", "block");

        setTimeout(function () {
          jqchat(".uiGlobalRoomsContainer").addClass("displayContent").removeClass("hideContent");
        }, 200);

        $serachText = jqchat('#chat-search').attr('placeholder');
        $serachText = $serachText.replace("@", "");
        jqchat("#chat-search").attr("placeholder", $serachText);
      }

      thiss.room = jqchat(".room-link:first", this).attr("room-data");
      thiss.targetUser = jqchat(".room-link:first", this).attr("user-data");
      thiss.targetFullname = jqchat(".room-link:first", this).text();

      chatNotification.getStatus(thiss.targetUser, function (status) {
        jqchat("#userRoomStatus > i").attr("class", "");
        jqchat("#userRoomStatus > i").addClass("user-" + status);
      });

      thiss.loadRoom(thiss.room);

      if (thiss.isMobileView()) {
        jqchat(".right-chat").css("display", "block");
        jqchat(".left-chat").css("display", "none");
        jqchat(".room-name").html(thiss.targetFullname);
      }
    });

    $leftPanel.on("click.toggleFavorite", ".uiIconChatFavorite", function () {
      var targetFav = jqchat(this).attr("user-data");
      thiss.toggleFavorite(targetFav);
    });

    // Responsive mode
    jqchat('#back').on("click", function () {
      jqchat(".uiLeftContainerArea").addClass("displayContent");
      jqchat(".uiLeftContainerArea").removeClass("hideContent");

      jqchat(".uiGlobalRoomsContainer").addClass("hideContent").removeClass("displayContent");

      setTimeout(function () {
        jqchat(".uiGlobalRoomsContainer").css("display", "none");
      }, 500);
      jqchat("#chat-video-button").attr("style", "");
    });
  };

  /**
   * Edit a chat message in a popup
   * @param msgDataId the data-id value of the message
   * @param msgData the raw text of the message to edit
   */
  ChatApplication.prototype.openEditMessagePopup = function (msgDataId) {
    if (msgDataId === null || msgDataId === undefined || msgDataId === "") {
      return;
    }

    var messages = TAFFY(this.chatRoom.messages);
    var tempMsg = messages({
      msgId: msgDataId
    });
    if (tempMsg.count() > 0) {
      var msg = tempMsg.first().msg;

      var msgHtml = msg.replace(/<br\/>/g, "\n");
      msgHtml = $('<div />').html(msgHtml).text();

      var $uitextarea = jqchat("#edit-modal-area");
      $uitextarea.val(msgHtml);
      $uitextarea.attr("data-id", msgDataId);
      window.require(['SHARED/bts_modal'], function() {
        jqchat('.edit-modal').modal({"backdrop": false});
      });
      chatApplication.setModalToCenter('.edit-modal');
      $uitextarea.focus();
    }
  }

  /**
   * Delete the message with id in the room
   *
   * @param id
   * @param callback
   */
  ChatApplication.prototype.deleteMessage = function (id, callback) {
    var thiss = this;
    // Send message to server
    requireChatCometd(function (cCometD) {
      cCometD.publish('/service/chat', JSON.stringify({
        "event": "message-deleted",
        "room": thiss.room,
        "sender": thiss.username,
        "dbName": thiss.dbName,
        "token": thiss.token,
        "data": {
          "msgId": id
        }
      }), function (publishAck) {
        if (publishAck.successful) {
          if (typeof callback === "function") {
            callback();
          }
        }
      });
    });
  };

  /**
   * Delete the selected team room
   *
   * @param callback
   */
  ChatApplication.prototype.deleteTeamRoom = function (callback) {
    jqchat.ajax({
      url: this.jzDeleteTeamRoom,
      data: {
        "room": this.room,
        "user": this.username,
        "dbName": this.dbName
      },
      headers: {
        'Authorization': 'Bearer ' + this.token
      },
      success: function (response) {
        if (typeof callback === "function") {
          callback();
        }
      },
      error: function (xhr, status, error) {
        alertError(chatBundleData["exoplatform.chat.team.delete.error"]);
      }
    });
  };

  /**
   * Edit the message with id with a new message
   *
   * @param id
   * @param newMessage
   * @param callback
   */
  ChatApplication.prototype.editMessage = function (id, newMessage, callback) {
    var thiss = this;
    // Send message to server
    requireChatCometd(function (cCometD) {
      cCometD.publish('/service/chat', JSON.stringify({
        "event": "message-updated",
        "room": thiss.room,
        "sender": thiss.username,
        "dbName": thiss.dbName,
        "token": thiss.token,
        "data": {
          "msgId": id,
          "msg": newMessage
        }
      }), function (publishAck) {
        if (publishAck.successful) {
          if (typeof callback === "function") {
            callback(id, newMessage);
          }
        }
      });
    });
  };

  /**
   * Saves a Team room for current user
   *
   * @param teamName
   * @param room
   * @param callback : callback method with roomId as a parameter
   */
  ChatApplication.prototype.saveTeamRoom = function (teamName, room, users, callback) {
    jqchat.ajax({
      type: 'POST',
      url: this.jzSaveTeamRoom,
      dataType: "json",
      data: {
        "teamName": encodeURIComponent(teamName),
        "room": room,
        "users": users,
        "user": this.username,
        "dbName": this.dbName
      },
      headers: {
        'Authorization': 'Bearer ' + this.token
      },

      success: function (response) {
        if (typeof callback === "function") {
          callback(response);
        }
      },

      error: function (xhr, status, error) {
        alert(error);
        jqchat(".btn-add-team").trigger("click");
      }
    });
  };

  ChatApplication.prototype.resize = function () {
    var $chatApplication = jqchat("#chat-application");
    var off = 80;
    if (fromChromeApp) {
      $chatApplication.css("padding", "0");
      off = 40;
      jqchat(".uiBox").css("margin", "0");
    }
    if (chatApplication.chatFullscreen == "true") {
      jqchat("#PlatformAdminToolbarContainer").css("display", "none");
    }

    var top = $chatApplication.offset().top;
    var height = jqchat(window).height();
    var heightChat = height - top - off;

    $chatApplication.height(heightChat);
    /* TCHAT HEIGHT ON MOBILE  */
    if (window.innerWidth > 767) {
      jqchat("#chats").height(heightChat - 105 - 61);
      jqchat("#chat-users").height(heightChat - 44);
      jqchat("#room-users-list").height(heightChat - 44 - 61 - 20); // remove header and padding
      jqchat("#room-users-collapse-bar").css("line-height", (heightChat - 44) + "px");

    } else {
      jqchat("#chats").height(heightChat - 38);
      jqchat("#chat-users").height(heightChat - 44);
      jqchat("#room-users-list").height(heightChat); // remove header and padding
      jqchat("#room-users-collapse-bar").css("line-height", (heightChat - 44) + "px");
      jqchat(".uiExtraLeftGlobal, .uiExtraLeftContainer").height(heightChat + 80); // remove header and padding
      jqchat(".uiExtraLeftGlobal, .uiExtraLeftContainer").css("min-height", window.innerHeight + "px"); // remove header and padding
    }
  };

  /**
   * Maintain Session : Only on Fluid app context
   */
  ChatApplication.prototype.maintainSession = function () {
    jqchat.ajax({
      url: this.jzMaintainSession,
      context: this,
      success: function (response) {
      },
      error: function (response) {
        this.chatSessionInt = clearInterval(this.chatSessionInt);
      }
    });
  };

  /**
   * Get the users of the space
   *
   * @param spaceId : the ID of the space
   * @param callback : return the json users data list as a parameter of the callback function
   */
  ChatApplication.prototype.getUsers = function (roomId, callback, asString) {
    jqchat.ajax({
      url: this.jzUsers,
      data: {
        "room": roomId,
        "user": this.username,
        "dbName": this.dbName
      },
      headers: {
        'Authorization': 'Bearer ' + this.token
      },
      dataType: "json",
      context: this,
      success: function (response) {
        if (typeof callback === "function") {
          var users = response;
          if (asString) {
            var userst = TAFFY(response.users);
            users = "";
            userst().each(function (user, number) {
              if (number > 0) users += ",";
              users += user.name;
            });
          }

          callback(users);
        }
      }
    });
  };

  /**
   * Get all users corresponding to filter
   *
   * @param filter : the filter (ex: Ben Pa)
   * @param callback : return the json users data list as a parameter of the callback function
   */
  ChatApplication.prototype.getAllUsers = function (filter, callback) {
    jqchat.ajax({
      url: this.jzUsers,
      data: {
        "filter": filter,
        "user": this.username,
        "dbName": this.dbName
      },
      headers: {
        'Authorization': 'Bearer ' + this.token
      },
      dataType: "json",
      context: this,
      success: function (response) {
        if (typeof callback === "function") {
          callback(response);
        }
      }
    });
  };

  ChatApplication.prototype.synGetAllUsers = function (filter, callback) {
    jqchat.ajax({
      async: false,
      url: this.jzUsers,
      data: {
        "filter": filter,
        "user": this.username,
        "dbName": this.dbName
      },
      headers: {
        'Authorization': 'Bearer ' + this.token
      },
      dataType: "json",
      context: this,
      success: function (response) {
        if (typeof callback === "function") {
          callback(response);
        }
      }
    });
  };

  /**
   * Load the list of rooms (left panel)
   */
  ChatApplication.prototype.loadRooms = function (callback) {
    // Avoid having two whoIsOnline requests in parallel
    if (this.loadRoomsRequest) {
      return;
    }

    if (this.token !== "---") {
      this.loadRoomsRequest = jqchat.ajax({
        context: this,
        url: '/portal/rest/chat/api/1.0/user/onlineUsers',
        dataType: 'text',
        success: function (users) {
          jqchat.ajax({
            context: this,
            url: this.jzChatWhoIsOnline,
            dataType: "json",
            data: {
              "user": this.username,
              "onlineUsers": users,
              "filter": this.userFilter,
              "timestamp": new Date().getTime(),
              "dbName": this.dbName
            },
            headers: {
              'Authorization': 'Bearer ' + this.token
            },
            success: function (response) {
              this.loadRoomsRequest = null;
              this.isLoaded = true;
              this.hidePanel(".chat-error-panel");
              this.hidePanel(".chat-sync-panel");
              chatApplication.rooms = TAFFY(response.rooms);

              this.renderRooms();

              if (callback !== undefined) {
                callback();
              }

              this.totalNotif = (Math.abs(response.unreadOffline) + Math.abs(response.unreadOnline) + Math.abs(response.unreadSpaces) + Math.abs(response.unreadTeams));
              if (fromChromeApp) {
                if (this.totalNotif > this.oldNotif && this.profileStatus !== "donotdisturb" && this.profileStatus !== "offline") {
                  chatNotification.showDetail();
                }
              } else if (window.fluid !== undefined) {
                if (this.totalNotif > 0)
                  window.fluid.dockBadge = this.totalNotif;
                else
                  window.fluid.dockBadge = "";
                if (this.totalNotif > this.oldNotif && this.profileStatus !== "donotdisturb" && this.profileStatus !== "offline") {
                  window.fluid.showGrowlNotification({
                    title: chatBundleData["exoplatform.chat.title"],
                    description: chatBundleData["exoplatform.chat.new.messages"],
                    priority: 1,
                    sticky: false,
                    identifier: "messages"
                  });
                }
              } else if (window.webkitNotifications !== undefined) {
                if (this.totalNotif > this.oldNotif && this.profileStatus !== "donotdisturb" && this.profileStatus !== "offline") {
                  var havePermission = window.webkitNotifications.checkPermission();
                  if (havePermission == 0) {
                    // 0 is PERMISSION_ALLOWED
                    var notification = window.webkitNotifications.createNotification(
                      '/chat/img/chat.png',
                      chatBundleData["exoplatform.chat.title"],
                      chatBundleData["exoplatform.chat.new.messages"]
                    );

                    notification.onclick = function () {
                      window.open("http://localhost:8080" + chatApplication.portalURI + "chat");
                      notification.close();
                    }
                    notification.show();
                  } else {
                    window.webkitNotifications.requestPermission();
                  }
                }
              }
              this.oldNotif = this.totalNotif;
              if (this.totalNotif > 0) {
                document.title = "Chat (" + this.totalNotif + ")";
              } else {
                document.title = "Chat";
              }

              if (this.isTeamAdmin) {
                jqchat(".btn-top-add-actions").css("display", "inline-block");
              }

            },
            error: function (response) {
              setTimeout(jqchat.proxy(this.errorOnRefresh, this), 1000);
            }
          });
        }
      });
    }
  };

  /**
   * Show rooms : convert json to html
   * @param rooms : a json object
   */
  ChatApplication.prototype.renderRooms = function () {
    var rooms = chatApplication.rooms;

    var roomPrevUser = "";
    var out = '<table class="table list-rooms">';
    var classArrow;
    var totalFavorites = 0, totalPeople = 0, totalSpaces = 0, totalTeams = 0;

    /**
     * FAVORITES
     */
    out += "<tr class='header-room accordion-heading header-favorites " + (this.showFavorites ? "open" : "") + "'><td colspan='3' style='border-top: 0;'>";
    if (this.showFavorites) classArrow = "uiIconChatArrowDown uiIconChatLightGray"; else classArrow = "uiIconChatArrowRight uiIconChatLightGray";
    out += chatBundleData["exoplatform.chat.favorites"];
    out += "<div class='nav pull-right uiDropdownWithIcon'><div class='uiAction iconDynamic'><i class='" + classArrow + " uiIconLightGray'></i></div></div>";
    out += '<span class="room-total total-favorites badgeDefault badgePrimary mini">' + chatBundleData["exoplatform.chat.no.favorite"] + '</span>';
    out += "</td></tr>"

    var roomsFavorites = rooms();
    roomsFavorites = roomsFavorites.filter({isFavorite: {is: true}});
    roomsFavorites.order("isFavorite desc, timestamp desc, fullName logical").each(function (room) {
      var rhtml = chatApplication.getRoomHtml(room, roomPrevUser);
      if (rhtml !== "") {
        roomPrevUser = room.user;
        if (chatApplication.showFavorites) {
          out += rhtml;
        } else {
          if (Math.round(room.unreadTotal) > 0) {
            totalFavorites += Math.round(room.unreadTotal);
          }
        }
      }
    });
    if (roomsFavorites.count() === 0 && this.showFavorites) {
      out += "<tr class='users-online accordion-body empty'><th colspan='3'>" + chatBundleData["exoplatform.chat.no.favorite"] + "</th></tr>";
    }

    var xOffline = "";
    if (chatApplication.showOffline) xOffline = " btn active";
    var xPeopleHistory = "";
    if (chatApplication.showPeopleHistory) xPeopleHistory = " btn active";
    var xSpacesHistory = "";
    if (chatApplication.showSpacesHistory) xSpacesHistory = " btn active";
    var xTeamsHistory = "";
    if (chatApplication.showTeamsHistory) xTeamsHistory = " btn active";

    /**
     * USERS
     */
    out += "<tr class='header-room accordion-heading header-people " + (this.showPeople ? "open" : "") + "'><td colspan='3'>";
    if (this.showPeople) classArrow = "uiIconChatArrowDown uiIconChatLightGray"; else classArrow = "uiIconChatArrowRight uiIconChatLightGray";
    out += chatBundleData["exoplatform.chat.people"];
    out += '<span class="room-total total-people badgeDefault badgePrimary mini"></span>';
    out += "<div class='nav pull-right uiDropdownWithIcon'><div class='uiAction iconDynamic'><i class='" + classArrow + " uiIconLightGray'></i></div></div>";
    out += "<ul class='nav pull-right uiDropdownWithIcon btn-top-history btn-top-history-people' style='margin-right: 5px;'><li><div class='actionIcon btn-history" + xPeopleHistory + "' data-type='people' href='javaScript:void(0)' data-toggle='tooltip' data-placement='bottom' title='" + chatBundleData["exoplatform.chat.show.history"] + "'><i class='uiIconChatClock uiIconChatLightGray'></i></div></li></ul>";
    out += "<ul class='nav pull-right uiDropdownWithIcon btn-top-offline' style='margin-right: 5px;'><li><div class='actionIcon btn-offline" + xOffline + "' data-type='people' href='javaScript:void(0)' data-toggle='tooltip' data-placement='bottom' title='";
    if (chatApplication.showOffline) {
      out += chatBundleData["exoplatform.chat.hide.users"];
    } else {
      out += chatBundleData["exoplatform.chat.show.users"];
    }
    out += "'><i class='uiIconChatMember uiIconChatLightGray'></i></div></li></ul>";
    out += "</td></tr>";

    var roomsPeople = rooms();
    roomsPeople = roomsPeople.filter({type: {"is": "u"}});
    roomsPeople = roomsPeople.filter({isFavorite: {"!is": true}});
    roomsPeople.order("timestamp desc, fullName logical").each(function (room, roomnumber) {
      if (roomnumber < 5 || chatApplication.showPeopleHistory || Math.round(room.unreadTotal) > 0) {
        var rhtml = chatApplication.getRoomHtml(room, roomPrevUser);
        if (rhtml !== "") {
          roomPrevUser = room.user;
          if (chatApplication.showPeople && (chatApplication.showOffline || (!chatApplication.showOffline && room.status !== "invisible"))) {
            out += rhtml;
          } else {
            if (Math.round(room.unreadTotal) > 0) {
              totalPeople += Math.round(room.unreadTotal);
            }
          }
        }
      }
    });
    if (roomsPeople.count() === 0 && this.showPeople) {
      out += "<tr class='users-online accordion-body empty'><th colspan='3'>" + chatBundleData["exoplatform.chat.no.connection"] + "</th></tr>";
    }

    /**
     * TEAMS
     */
    out += "<tr class='header-room accordion-heading header-teams " + (this.showTeams ? "open" : "") + "'><td colspan='3'>";
    if (this.showTeams) classArrow = "uiIconChatArrowDown uiIconChatLightGray"; else classArrow = "uiIconChatArrowRight uiIconChatLightGray";
    out += chatBundleData["exoplatform.chat.teams"];
    out += '<span class="room-total total-teams badgeDefault badgePrimary mini"></span>';
    out += "<div class='nav pull-right uiDropdownWithIcon'><div class='uiAction iconDynamic'><i class='" + classArrow + " uiIconLightGray'></i></div></div>";
    out += "<ul class='nav pull-right uiDropdownWithIcon btn-top-history btn-top-history-teams' style='margin-right: 5px;'><li><div class='actionIcon btn-history" + xTeamsHistory + "' data-type='team' href='javaScript:void(0)' data-toggle='tooltip' title='" + chatBundleData["exoplatform.chat.show.history"] + "'><i class='uiIconChatClock uiIconChatLightGray'></i></div></li></ul>";
    out += "<ul class='nav pull-right uiDropdownWithIcon btn-top-add-actions' style='margin-right: 5px;'><li><div class='actionIcon btn-add-team' href='javaScript:void(0)' data-toggle='tooltip' data-placement='bottom' title='" + chatBundleData["exoplatform.chat.create.team"] + "'><i class='uiIconChatSimplePlusMini uiIconChatLightGray'></i></div></li></ul>";
    out += "</td></tr>";

    var roomsTeams = rooms();
    roomsTeams = roomsTeams.filter({type: {"is": "t"}});
    roomsTeams = roomsTeams.filter({isFavorite: {"!is": true}});
    roomsTeams.order("timestamp desc, fullName logical").each(function (room, roomnumber) {
      if (roomnumber < 5 || chatApplication.showTeamsHistory || Math.round(room.unreadTotal) > 0) {
        var rhtml = chatApplication.getRoomHtml(room, roomPrevUser);
        if (rhtml !== "") {
          roomPrevUser = room.user;
          if (chatApplication.showTeams) {
            out += rhtml;
          } else {
            if (Math.round(room.unreadTotal) > 0) {
              totalTeams += Math.round(room.unreadTotal);
            }
          }
        }
      }
    });

    if (roomsTeams.count() === 0 && this.showTeams) {
      out += "<tr class='users-online accordion-body empty'><th colspan='3'>" + chatBundleData["exoplatform.chat.no.team"] + "</th></tr>";
    }

    /**
     * SPACES
     */
    out += "<tr class='header-room accordion-heading header-spaces " + (this.showSpaces ? "open" : "") + "'><td colspan='3'>";
    if (this.showSpaces) classArrow = "uiIconChatArrowDown uiIconChatLightGray"; else classArrow = "uiIconChatArrowRight uiIconChatLightGray";
    out += chatBundleData["exoplatform.chat.spaces"];
    out += '<span class="room-total total-spaces badgeDefault badgePrimary mini"></span>';
    out += "<div class='nav pull-right uiDropdownWithIcon'><div class='uiAction iconDynamic'><i class='" + classArrow + " uiIconLightGray'></i></div></div>";
    out += "<ul class='nav pull-right uiDropdownWithIcon btn-top-history btn-top-history-spaces' style='margin-right: 5px;'><li><div class='actionIcon btn-history" + xSpacesHistory + "' data-type='space' href='javaScript:void(0)' data-toggle='tooltip' title='" + chatBundleData["exoplatform.chat.show.history"] + "'><i class='uiIconChatClock uiIconChatLightGray'></i></div></li></ul>";
    out += "</td></tr>";

    var roomsSpaces = rooms();
    roomsSpaces = roomsSpaces.filter({type: {"is": "s"}});
    roomsSpaces = roomsSpaces.filter({isFavorite: {"!is": true}});
    roomsSpaces.order("timestamp desc, fullName logical").each(function (room, roomnumber) {
      if (roomnumber < 3 || chatApplication.showSpacesHistory || Math.round(room.unreadTotal) > 0) {
        var rhtml = chatApplication.getRoomHtml(room, roomPrevUser);
        if (rhtml !== "") {
          roomPrevUser = room.user;
          if (chatApplication.showSpaces) {
            out += rhtml;
          } else {
            if (Math.round(room.unreadTotal) > 0) {
              totalSpaces += Math.round(room.unreadTotal);
            }
          }
        }
      }
    });

    if (roomsSpaces.count() === 0 && this.showSpaces) {
      out += "<tr class='users-online accordion-body empty'><th colspan='3'>" + chatBundleData["exoplatform.chat.no.space"] + "</th></tr>";
    }

    out += '</table>';

    jqchat("#chat-users").html(out);

    jqchat("[data-toggle='tooltip']").tooltip();

    if (roomsPeople.count() <= 5) {
      jqchat(".btn-top-history-people").hide();
    }
    if (roomsTeams.count() <= 5) {
      jqchat(".btn-top-history-teams").hide();
    }
    if (roomsSpaces.count() <= 3) {
      jqchat(".btn-top-history-spaces").hide();
    }

    if (chatApplication.isTeamAdmin) {
      jqchat(".btn-top-add-actions").css("display", "inline-block");
    }

    if (totalFavorites > 0) {
      jqchat(".total-favorites").html(totalFavorites);
      jqchat(".total-favorites").css("display", "inline-block");
    }

    if (totalPeople > 0) {
      jqchat(".total-people").html(totalPeople);
      jqchat(".total-people").css("display", "inline-block");
    }

    if (totalSpaces > 0) {
      jqchat(".total-spaces").html(totalSpaces);
      jqchat(".total-spaces").css("display", "inline-block");
    }

    if (totalTeams > 0) {
      jqchat(".total-teams").html(totalTeams);
      jqchat(".total-teams").css("display", "inline-block");
    }
  };

  ChatApplication.prototype.getRoomHtml = function (room, roomPrevUser) {
    var out = "";
    if (room.user !== roomPrevUser) {
      out += '<tr id="users-online-' + room.user.replace(".", "-") + '" class="users-online accordion-body">';
      out += '  <td class="td-status">';
      out += '    <i class="' + (room.type !== "u" ? 'uiIconChatTeam uiIconChatLightGray' : '') + (room.isFavorite == true ? ' user-favorite' : ' user-status') + ' user-' + room.status + '"></i>';
      out += '  </td>';
      out += '  <td>';
      if (room.isActive == "true") {
        out += '<span user-data="' + room.user + '" room-data="' + room.room + '" class="room-link">' + jqchat('<div />').text(room.fullName).html() + '</span>';
      } else {
        out += '<span class="room-inactive muted">' + room.user + '</span>';
      }
      out += '  </td>';
      out += '  <td>';
      if (room.hasLocalMsg) {
        out += '<i class="uiIconNotification pull-right" data-toggle="tooltip" data-placement="top" title="' + chatBundleData["exoplatform.chat.msg.notDelivered"] + '"></i>';
      } else {
        if (Math.round(room.unreadTotal) > 0) {
          out += '<span class="room-total badgeDefault badgePrimary mini" style="float:right;" data="' + room.unreadTotal + '">' + room.unreadTotal + '</span>';
        } else {
          out += '<i class="uiIconChatFavorite pull-right' + (room.isFavorite == true ? ' user-favorite' : ' user-status');
          out += '" user-data="' + room.user + '" data-toggle="tooltip" data-placement="bottom"';
          if (room.isFavorite == true) {
            out += ' title="' + chatBundleData["exoplatform.chat.remove.favorites"];
          } else {
            out += ' title="' + chatBundleData["exoplatform.chat.add.favorites"];
          }
          out += '"></i>';
        }
      }
      out += '  </td>';
      out += '</tr>';
    }
    return out;
  };

  ChatApplication.prototype.enableMessageComposer = function (bool) {
    if (bool) {//enable
      jqchat("div.chat-message").css({//enable the chat footer again
        "pointer-events": "",
        "opacity": ""
      });
    } else {//disable
      jqchat("div.chat-message").css({
        "pointer-events": "none",
        "opacity": "0.3"
      });
    }
  }

  ChatApplication.prototype.loadRoom = function (room) {
    jqchat("#chats").removeClass("hide-messages");
    jqchat('#chats').html("");
    if (room) {
      this.room = room;
      var TAFFYRoom = this.rooms({room: room}).first();
      this.targetUser = TAFFYRoom.user;
      this.targetFullname = TAFFYRoom.fullName;
    }

    if (this.configMode == true) {
      this.configMode = false;//we're not on the config mode anymore
      chatApplication.enableMessageComposer(true);
    }

    var thiss = this;
    this.chatRoom.owner = "";
    if (this.targetUser === undefined) {
      return;
    }

    // hide admin actions - we need to check if the current is the admin of the room before displaying them
    jqchat("#chat-team-button-dropdown .only-admin").hide();
    // reset room users panel
    this.chatRoom.users = [];
    jqchat("#room-users-list").html("");
    jqchat("#room-users-title-nb-users").html("()");

    if (this.chatRoom.lastCallOwner !== this.targetUser) {
      jqchat('#chats').off("scroll");

      // Disable composer while switching from a room to another
      chatApplication.enableMessageComposer(false);
      chatApplication.updateMeetingButtonStatus(false);

      // Empty room messages and add loading icon
      this.chatRoom.emptyChatZone(true);

      // Add a flag for room loading operation with the id of the room
      this.chatRoom.setNewRoom(true);
      this.chatRoom.callingOwner = this.targetUser;
    }

    jqchat(".users-online").removeClass("accordion-active");
    if (this.isDesktopView()) {
      var escapedTargetUser = this.targetUser.replace(".", "-").replace("@", "\\@");
      var $targetUser = jqchat("#users-online-" + escapedTargetUser);
      $targetUser.addClass("accordion-active");
      jqchat(".room-total").removeClass("badgeWhite");
      $targetUser.find(".room-total").addClass("badgeWhite");
    }


    jqchat("#room-detail").css("display", "block");
    jqchat("#chat-team-button").css("display", "none");
    jqchat("#chat-room-detail-fullname").text(this.targetFullname);

    jqchat(".btn-weemo-conf").css("display", "none");
    jqchat(".btn-weemo-conf").addClass("disabled");
    if (typeof weemoExtension !== 'undefined') {
      jqchat(".btn-weemo").css("display", "block");
      jqchat(".btn-weemo").addClass("disabled");
      jqchat(".room-detail-button").show();
    }

    if (this.targetUser.indexOf("space-") === -1 && this.targetUser.indexOf("team-") === -1) {
      ////// USER
      jqchat(".uiRoomUsersContainerArea").hide();
      jqchat(".meeting-action-task").css("display", "block");
      jqchat(".room-detail-avatar").show();
      jqchat("#chat-team-button-dropdown").hide();
      jqchat("#userRoomStatus").removeClass("hide").show();
      jqchat(".target-avatar-link").attr("href", chatApplication.portalURI + "profile/" + this.targetUser);
      jqchat(".target-avatar-image").attr("onerror", "this.src='/chat/img/user-default.jpg';");
      jqchat(".target-avatar-image").attr("src", "/rest/v1/social/users/" + this.targetUser + "/avatar");

    } else if (this.targetUser.indexOf("team-") === -1) {
      ////// SPACE
      this.loadRoomUsers();
      jqchat("#userRoomStatus").hide();
      jqchat(".meeting-action-task").css("display", "block");
      var spaceName = this.targetFullname.toLowerCase().split(" ").join("_");
      jqchat(".room-detail-avatar").show();
      jqchat(".target-avatar-link").attr("href", "/portal/g/:spaces:" + spaceName + "/" + spaceName);
      jqchat(".target-avatar-image").attr("onerror", "this.src='/eXoSkin/skin/images/themes/default/social/skin/ShareImages/SpaceAvtDefault.png';");
      jqchat(".target-avatar-image").attr("src", "/rest/v1/social/spaces/" + this.targetFullname + "/avatar");

    } else {
      ////// TEAM
      jqchat.ajax({
        url: this.jzChatGetCreator,
        data: {
          "room": this.targetUser,
          "user": this.username,
          "dbName": this.dbName
        },
        headers: {
          'Authorization': 'Bearer ' + this.token
        },
        context: this,
        success: function (response) {
          var creator = response;
          this.chatRoom.owner = creator;
          jqchat(".team-button > .uiDropdownWithIcon").css("display", "block");
          jqchat("#chat-team-button-dropdown").show();//we should always show the dropdown list when we click on a room/team
          jqchat("#userRoomStatus").hide();
          if (creator === this.username) {
            jqchat("#chat-team-button-dropdown .only-admin").show();
            jqchat("#userRoomStatus").hide();
            jqchat("#chat-team-button").show();
            jqchat("#team-delete-button").show();
            jqchat("#chat-team-button-dropdown").show();
            jqchat("#userRoomStatus").hide();
          } else {
            jqchat("#userRoomStatus").removeClass("hide").show();
          }
        },
        error: function (xhr, status, error) {
        }
      });

      this.loadRoomUsers();
      jqchat(".meeting-action-task").css("display", "block");
      jqchat(".room-detail-avatar").show();
      jqchat(".target-avatar-link").attr("href", "#");
      jqchat(".target-avatar-image").attr("src", "/eXoSkin/skin/images/themes/default/social/skin/ShareImages/SpaceAvtDefault.png");
    }

    if (this.targetUser.indexOf("space-") >= 0 || this.targetUser.indexOf("team-") >= 0) {
      jqchat.ajax({
        url: this.jzChatIsFavorite,
        data: {
          "user": this.username,
          "targetUser": this.targetUser,
          "dbName": this.dbName
        },
        headers: {
          'Authorization': 'Bearer ' + this.token
        },
        context: this,
        success: function (response) {
          var $teamRemoveFromFavoritButton = jqchat("#team-remove-from-favorites-button");
          var $teamAddToFavoritButton = jqchat("#team-add-to-favorites-button");

          $teamRemoveFromFavoritButton.unbind('click');
          $teamAddToFavoritButton.unbind('click');
          var toggleFav = function () {
            thiss.toggleFavorite(thiss.targetUser);
            $teamRemoveFromFavoritButton.toggle();
            $teamAddToFavoritButton.toggle();
          }
          $teamRemoveFromFavoritButton.click(toggleFav);
          $teamAddToFavoritButton.click(toggleFav);
          if (response == "true") {
            $teamRemoveFromFavoritButton.show();
            $teamAddToFavoritButton.hide();
          } else {
            $teamAddToFavoritButton.show();
            $teamRemoveFromFavoritButton.hide();
          }
        },
        error: function (xhr, status, error) {
          console.log("ERROR::" + xhr.responseText);
        }
      });
    }

    this.chatRoom.id = this.room;
    this.chatRoom.init(this.username, this.fullname, this.token, this.targetUser, this.targetFullname, this.dbName, function (room) {
      chatApplication.room = room;
      var $msg = jqchat('#msg');
      chatApplication.activateRoomButtons();
      if (chatApplication.isDesktopView()) $msg.focus();

      // Clear the unread message number label if any
      var room = chatApplication.rooms({room: room});
      room.update({unreadTotal: 0});
      chatApplication.renderRooms();
    });
  };

  ChatApplication.prototype.activateRoomButtons = function () {
    var $msg = jqchat('#msg');
    var $msButtonRecord = jqchat(".msButtonRecord");
    var $msgEmoticons = jqchat(".msg-emoticons");
    var $meetingActionToggle = jqchat(".meeting-action-toggle");
    $msg.removeAttr("disabled");
    jqchat("#chat-record-button").show();
    $msButtonRecord.removeAttr(("disabled"));
    $msButtonRecord.attr("data-toggle", "tooltip");
    $msgEmoticons.parent().removeClass("disabled");
    $msgEmoticons.parent().attr("data-toggle", "tooltip");
    $meetingActionToggle.removeClass("disabled");
    $meetingActionToggle.children("span").attr("data-toggle", "tooltip");
    jqchat("[data-toggle='tooltip']").tooltip("enable");
  };

  ChatApplication.prototype.onRefreshCallback = function (code) {
    if (code === 0) { // SUCCESS
      chatApplication.hidePanel(".chat-login-panel");
      chatApplication.hidePanel(".chat-error-panel");
    } else if (code === 1) { //ERROR
      /*
       if ( jqchat(".chat-error-panel").css("display") == "none") {
       chatApplication.showLoginPanel();
       } else {
       chatApplication.hidePanel(".chat-login-panel");
       }
       */
    }
  };

  ChatApplication.prototype.onShowMessagesCallback = function () {
    // highlight searched terms
    // sh_highlightDocument();
  };

  /**
   * Error On Refresh
   */
  ChatApplication.prototype.errorOnRefresh = function () {
    this.isLoaded = true;
    this.hidePanel(".chat-sync-panel");
    this.hidePanel(".chat-login-panel");
    chatNotification.changeStatusChat(this.username, "offline");
    this.showErrorPanel();
  };

  ChatApplication.prototype.setModalToCenter = function (modalFormClass) {
    if (modalFormClass !== undefined) {

      // Set form position to screen center
      var centerTop = (jqchat(window).height() - jqchat(modalFormClass).height()) / 2;
      centerTop = centerTop >= 0 ? centerTop : jqchat(modalFormClass).offset().top;
      var centerLeft = (jqchat(window).width() - jqchat(modalFormClass).width()) / 2;
      centerLeft = centerLeft >= 0 ? centerLeft : jqchat(modalFormClass).offset().left;
      jqchat(modalFormClass).offset({top: centerTop, left: centerLeft})
    }
  };

  /**
   * Toggle Favorite : server call
   * @param targetFav : the user or space to put/remove in favorite
   */
  ChatApplication.prototype.toggleFavorite = function (targetFav) {
    console.log("FAVORITE::" + targetFav);
    var room = chatApplication.rooms({user: targetFav});

    jqchat.ajax({
      url: this.jzChatToggleFavorite,
      data: {
        "user": this.username,
        "token": this.token,
        "targetUser": targetFav,
        "favorite": !room.first().isFavorite
      },
      headers: {
        'Authorization': 'Bearer ' + this.token
      },
      context: this,
      success: function (response) {
      },
      error: function (xhr, status, error) {
      }
    });
  };

  /**
   * Update Meeting Button status
   *
   * @param isStarted: true or false
   */
  ChatApplication.prototype.updateMeetingButtonStatus = function (isStarted) {
    var $icon = jqchat(".msButtonRecord").children("i");
    var $span = jqchat(".msButtonRecord").children("span");
    if (isStarted) {
      $icon.addClass("uiIconChatRecordStop");
      $icon.removeClass("uiIconChatRecordStart");
    } else {
      $icon.addClass("uiIconChatRecordStart");
      $icon.removeClass("uiIconChatRecordStop");
    }

    var tooltipText = $icon.hasClass("uiIconChatRecordStart") ? chatBundleData["exoplatform.chat.meeting.start"] : chatBundleData["exoplatform.chat.meeting.stop"];
    $icon.parent().tooltip('hide')
      .attr('data-original-title', tooltipText)
      .tooltip('fixTitle');

    $span.html(tooltipText);
  };

  /**
   * Search and filter (filter on users or spaces if starts with @
   * @param filter
   */
  ChatApplication.prototype.search = function (filter) {
    if (filter == ":aboutme" || filter == ":about me") {
      this.showAboutPanel();
    }

    var index = filter.indexOf("@");
    if (index !== 0 || filter.length == 0) {
      this.chatRoom.highlight = filter;
      this.chatRoom.showMessages();
    }

    if (index === 0 || filter.length == 0) {
      var userFilter = filter.length == 0 ? filter : filter.substr(1, filter.length - 1);
      if (userFilter == this.userFilter) {
        return;
      }
      this.userFilter = userFilter;
      this.filterInt = clearTimeout(this.filterInt);
      this.filterInt = setTimeout(jqchat.proxy(this.loadRooms, this), 500);
    }
  };

  /**
   * Check Browser Viewport Status
   * @returns {boolean}
   */
  ChatApplication.prototype.checkViewportStatus = function () {
    return (jqchat("#NavigationPortlet").css("display") === "none");
  };

  ChatApplication.prototype.isMobileView = function () {
    return this.checkViewportStatus();
  };

  ChatApplication.prototype.isDesktopView = function () {
    return !this.checkViewportStatus();
  };


  /**
   * Set Current Status
   * @param status
   * @param callback
   */
  ChatApplication.prototype.setStatus = function (status, callback) {

    if (status !== undefined) {
      // Send update status message (forward event to others client and update mongodb chat status)
      var thiss = this;
      requireChatCometd(function (cCometD) {
        cCometD.publish('/service/chat', JSON.stringify({
          "event": "user-status-changed",
          "sender": thiss.username,
          "room": thiss.username,
          "dbName": thiss.dbName,
          "token": thiss.token,
          "data": {
            "status": status
          }
        }), function (publishAck) {
          if (publishAck.successful) {
            if (typeof callback === "function") {
              callback(status);
            }
          }
        })
      });

      // Update platform user status
      var url = this.plfUserStatusUpdateUrl + this.username + "?status=" + status;
      jqchat.ajax({
        url: url,
        type: 'PUT',
        context: this,

        success: function (response) {
        },
        error: function (response) {
        }
      });

    }

  };

  ChatApplication.prototype.showHelp = function () {
    jqchat('.help-modal').modal({"backdrop": false});
  };

  ChatApplication.prototype.showAsText = function () {

    this.chatRoom.showAsText(function (response) {
      jqchat("#text-modal-area").html(response);
      jqchat('#text-modal-area').on("click", function () {
        this.select();
      });
      jqchat('.text-modal').modal({"backdrop": false});
    });

  };

  ChatApplication.prototype.setStatusAvailable = function () {
    chatApplication.setStatus("available");
  };

  ChatApplication.prototype.setStatusAway = function () {
    chatApplication.setStatus("away");
  };

  ChatApplication.prototype.setStatusDoNotDisturb = function () {
    chatApplication.setStatus("donotdisturb");
  };

  ChatApplication.prototype.setStatusInvisible = function () {
    chatApplication.setStatus("invisible");
  };

  /**
   * Send message to server
   * @param msg : the msg to send
   * @param callback : the method to execute on success
   */
  ChatApplication.prototype.sendMessage = function (msg, callback) {
    var context = {"msg": msg, "options": {}, "callback": callback, "continueSend": true};

    this.trigger("beforeSend", context);
    if (!context.continueSend) {
      return;
    }
    msg = context.msg;
    var options = context.options;
    callback = context.callback;

    var isSystemMessage = (msg.indexOf("/") === 0 && msg.length > 2);
    var sendMessageToServer = true;
    if (isSystemMessage) {
      sendMessageToServer = false;
      if (msg.indexOf("/me") === 0) {
//      msg = msg.replace("/me", this.fullname);
        options.type = "type-me";
        options.username = this.username;
        options.fullname = this.fullname;
        sendMessageToServer = true;
      } else if (msg.indexOf("/terminate") === 0) {
        if (msg.indexOf("/terminate") === 0) {
          var optionsStop = {
            type: "type-meeting-stop",
            fromUser: chatApplication.username,
            fromFullname: chatApplication.fullname
          };
          this.chatRoom.sendMessage("", optionsStop, isSystemMessage, callback);
        }

        msg = chatBundleData["exoplatform.chat.call.terminated"];
        options.timestamp = Math.round(new Date().getTime() / 1000);
        options.type = "call-off";
        sendMessageToServer = true;
      } else if (msg.indexOf("/export") === 0) {
        this.showAsText();
      } else if (msg.indexOf("/help") === 0) {
        this.showHelp();
      }
    }

    if (sendMessageToServer) {
      this.chatRoom.sendMessage(msg, options, isSystemMessage, callback);
    }
    jqchat("#msg").val("");
  };


  /**
   ##################                           ##################
   ##################                           ##################
   ##################   CHAT PANELS             ##################
   ##################                           ##################
   ##################                           ##################
   */

  ChatApplication.prototype.hidePanel = function (panel) {
    var $uiPanel = jqchat(panel);
    $uiPanel.width(jqchat('#chat-application').width() + 40);
    $uiPanel.height(jqchat('#chat-application').height());
    $uiPanel.css("display", "none");
    $uiPanel.html("");
  };

  ChatApplication.prototype.hidePanels = function () {
    this.hidePanel(".chat-sync-panel");
    this.hidePanel(".chat-error-panel");
    this.hidePanel(".chat-login-panel");
    this.hidePanel(".chat-about-panel");
  };

  ChatApplication.prototype.showSyncPanel = function () {
    if (!this.isLoaded) {
      this.hidePanels();
      var $chatSyncPanel = jqchat(".chat-sync-panel");
      var marginTop = Math.round($chatSyncPanel.height() / 2) - 32;
      $chatSyncPanel.html("<img src=\"/chat/img/sync.gif\" width=\"64px\" class=\"chatSync\" style=\"margin-top: " + marginTop + "px;\" />");
      $chatSyncPanel.css("display", "block");
    }
  };

  ChatApplication.prototype.showErrorPanel = function () {
    this.hidePanels();
    var $chatErrorPanel = jqchat(".chat-error-panel");
    $chatErrorPanel.html(chatBundleData["exoplatform.chat.panel.error1"] + "<br/><br/>" + chatBundleData["exoplatform.chat.panel.error2"]);
    $chatErrorPanel.css("display", "block");
  };

  ChatApplication.prototype.showLoginPanel = function () {
    this.hidePanels();
    var $chatLoginPanel = jqchat(".chat-login-panel");
    $chatLoginPanel.html(chatBundleData["exoplatform.chat.panel.login1"] + "<br><br><a href=\"#\" onclick=\"javascript:reloadWindow();\">" + chatBundleData["exoplatform.chat.panel.login2"] + "</a>");
    $chatLoginPanel.css("display", "block");
  };

  ChatApplication.prototype.showAboutPanel = function () {
    var about = "eXo Chat<br>";
    about += "Version " + chatBundleData["version"] + "<br><br>";
    about += chatBundleData["exoplatform.chat.designed"] + " <a href=\"mailto:bpaillereau@exoplatform.com\">Benjamin Paillereau</a><br>";
    about += chatBundleData["exoplatform.chat.for"] + " <a href=\"http://www.exoplatform.com\" target=\"_blank\">eXo Platform 4</a><br><br>";
    about += chatBundleData["exoplatform.chat.sources"] + " <a href=\"https://github.com/exo-addons/chat-application\" target=\"_blank\">https://github.com/exo-addons/chat-application</a>";
    about += "<br><br><a href=\"#\" id=\"about-close-btn\" >" + chatBundleData["exoplatform.chat.close"] + "</a>";
    this.hidePanels();
    var $chatAboutPanel = jqchat(".chat-about-panel");
    $chatAboutPanel.html(about);
    $chatAboutPanel.width(jqchat('#chat-application').width() + 40);
    $chatAboutPanel.height(jqchat('#chat-application').height());
    $chatAboutPanel.css("display", "block");

    var thiss = this;
    jqchat("#about-close-btn").on("click", function () {
      thiss.hidePanel('.chat-about-panel');
      jqchat('#chat-search, #chat-searchResp').attr("value", "");
    });
  };

  ChatApplication.prototype.displayVideoCallOnChatApp = function () {
    if (typeof weemoExtension === 'undefined' || window.location.href.indexOf(chatApplication.portalURI + "chat") === -1) {
      return;
    }

    var isTurnOnWeemoCallButton = (
      (weemoExtension.isTurnOffForUser === "false" && (this.targetUser.indexOf("space-") === -1 && this.targetUser.indexOf("team-") === -1 && this.targetUser !== ""))
      || (weemoExtension.isTurnOffForGroupCall === "false" && (this.targetUser.indexOf("space-") !== -1 || this.targetUser.indexOf("team-") !== -1 && this.targetUser !== ""))
    );

    jqchat(".btn-weemo").unbind("click").one("click", function () {
      if (!jqchat(this).hasClass("disabled")) {
        if (isTurnOnWeemoCallButton) {
          var targetUser = chatApplication.targetUser.trim();
          var targetFullname = chatApplication.targetFullname.trim();
          if (targetUser.indexOf("space-") === -1
            && targetUser.indexOf("team-") === -1
            && targetUser !== ""
            && weemoExtension.hasOneOneCallPermission(targetUser) === "false") {
            eXo.ecm.VideoCalls.showReceivingPermissionInterceptor(targetFullname);
            chatApplication.setModalToCenter('#receive-permission-interceptor');
          } else {
            //sightCallExtension.createWeemoCall(targetUser, targetFullname, chatMessage);
            jzStoreParam("room", chatApplication.room);
            jzStoreParam("targetFullname", targetFullname);
            jzStoreParam("targetUser", targetUser);

            if (targetUser.indexOf("space-") === -1 && targetUser.indexOf("team-") === -1) {
              weemoExtension.showVideoPopup(chatApplication.portalURI + 'videocallpopup?callee=' + targetUser.trim() + '&mode=one&hasChatMessage=true');
            } else {
              var isSpace = (targetUser.indexOf("space-") !== -1);
              var spaceOrTeamName = targetFullname.toLowerCase().split(" ").join("_");

              weemoExtension.showVideoPopup(chatApplication.portalURI + 'videocallpopup?mode=host&isSpace=' + isSpace + "&spaceOrTeamName=" + spaceOrTeamName);
            }
          }
        } else {
          eXo.ecm.VideoCalls.showPermissionInterceptor();
          chatApplication.setModalToCenter('#permission-interceptor');
        }
      }
    });

    jqchat(".btn-weemo-conf").unbind("click").one("click", function () {
      if (!jqchat(this).hasClass("disabled")) {
        var targetUser = chatApplication.targetUser.trim();
        var targetFullname = chatApplication.targetFullname.trim();
        var isSpace = (targetUser.indexOf("space-") !== -1);
        var spaceOrTeamName = targetFullname.toLowerCase().split(" ").join("_");

        jzStoreParam("room", chatApplication.room);
        jzStoreParam("targetFullname", targetFullname);
        jzStoreParam("targetUser", targetUser);
        jzStoreParam("meetingPointId", weemoExtension.meetingPointId);
        weemoExtension.showVideoPopup(chatApplication.portalURI + 'videocallpopup?mode=attendee&isSpace=' + isSpace + "&spaceOrTeamName=" + spaceOrTeamName);
        //weemoExtension.joinWeemoCall(chatApplication.targetUser, chatApplication.targetFullname, chatMessage);
      }
    });

    chatNotification.getStatus(chatApplication.targetUser, function(activity) {
      if (chatApplication.targetUser.indexOf("space-") === -1 && chatApplication.targetUser.indexOf("team-") === -1) {
        if (activity !== "offline" && activity !== "invisible") {
          jqchat(".btn-weemo").removeClass("disabled");
          jqchat(".btn-weemo-conf").removeClass("disabled");
        } else {
          jqchat(".btn-weemo").addClass("disabled");
          jqchat(".btn-weemo-conf").addClass("disabled");
        }
      } else {
        jqchat(".btn-weemo").removeClass("disabled");
        //jqchat(".btn-weemo-conf").removeClass("disabled");
      }
    });

    setTimeout(function () {
      chatApplication.displayVideoCallOnChatApp();
      var chatMessage = JSON.parse(jzGetParam("chatMessage", '{}'));
      if ((chatMessage.url !== undefined) && (chatNotification !== undefined) && jzGetParam("isSightCallConnected", false) === "false"
        && (jzGetParam("callMode") === "one" || jzGetParam("callMode") === "host")) {
        var roomToCheck = chatMessage.room;

        chatNotification.checkIfMeetingStarted(roomToCheck, function (callStatus, recordStatus) {

          if (callStatus !== 1) { // Already terminated
            jzStoreParam("chatMessage", JSON.stringify({}));
            return;
          }

          // Also Update record status
          if (recordStatus === 1) {
            var options = {
              type: "type-meeting-stop",
              fromUser: chatNotification.username,
              fromFullname: chatNotification.username
            };
            chatNotification.sendFullMessage(
              chatMessage.user,
              chatMessage.token,
              chatMessage.targetUser,
              roomToCheck,
              "",
              options,
              "true"
            );
          }

          var options = {};
          options.timestamp = Math.round(new Date().getTime() / 1000);
          options.type = "call-off";
          chatNotification.sendFullMessage(
            chatMessage.user,
            chatMessage.token,
            chatMessage.targetUser,
            roomToCheck,
            chatBundleData["exoplatform.chat.call.terminated"],
            options,
            "true"
          );

          localStorage.removeItem("chatMessage");
          localStorage.removeItem("isSightCallConnected");
          localStorage.removeItem("callMode");
        });
      }
    }, 3000);
  };

  /**
   * Load Room Users : server call
   */
  ChatApplication.prototype.loadRoomUsers = function () {
    var thiss = this;
    var roomUsersContainer = jqchat(".uiRoomUsersContainerArea");
    if (this.targetUser !== undefined) {
      roomUsersContainer.show();

      if (!roomUsersContainer.is(".room-users-collapsed")) {
        roomUsersContainer.addClass("room-users-collapsed");//need a default class for responsive
      }

      // fetch room users
      chatApplication.getUsers(this.targetUser, function (jsonData) {
        var roomUsers = jsonData.users;

        var _users = '';
        roomUsers.forEach(function (currentValue, index, arr) {
          _users += currentValue.name + ','
        });

        jqchat.ajax({
          context: this,
          url: '/rest/chat/api/1.0/user/onlineStatus',
          data: {
            users: _users
          },
          success: function (response) {
            roomUsers.forEach(function (currentValue, index, arr) {
              if (!response[currentValue.name]) {
                arr[index].status = "offline";
              }
            });

            // check if there are changes
            var roomUserHasChanged = false;
            if (roomUsers.length === thiss.chatRoom.users.length) {
              roomUserHasChanged = !roomUsers.every(function (roomUser, index) {
                return (roomUser.name == thiss.chatRoom.users[index].name
                && roomUser.fullname == thiss.chatRoom.users[index].fullname
                && roomUser.status == thiss.chatRoom.users[index].status);
              });
            } else {
              roomUserHasChanged = true;
            }

            // if the room users have changed, update the panel
            if (roomUserHasChanged === true) {
              thiss.chatRoom.users = roomUsers;

              // generate room users list DOM
              thiss.renderRoomUsers();
            }

            // User Profile Popup initialize
            var portal = eXo.env.portal;
            var restUrl = window.location.origin + portal.context + '/' + portal.rest + '/social/people/getPeopleInfo/{0}.json';
            var usersContainers = jqchat('#room-users-list .room-user');
            window.require(['SHARED/userPopup'], function() {
              jqchat.each(usersContainers, function (idx, el) {
                var userId = jqchat(el).attr('data-name');

                jqchat(el).userPopup({
                  restURL: restUrl,
                  userId: userId,
                  labels: {
                    StatusTitle: chatBundleData["exoplatform.chat.user.popup.status"],
                    Connect: chatBundleData["exoplatform.chat.user.popup.connect"],
                    Confirm: chatBundleData["exoplatform.chat.user.popup.confirm"],
                    CancelRequest: chatBundleData["exoplatform.chat.user.popup.cancel"],
                    RemoveConnection: chatBundleData["exoplatform.chat.user.popup.remove.connection"]
                  },
                  content: false,
                  defaultPosition: "left",
                  keepAlive: true,
                  maxWidth: "240px"
                });
              });
            });

            // update nb of users in the room
            jqchat("#room-users-title-nb-users").html("(" + (thiss.chatRoom.users.length - 1) + ")");
          }
        });
      }, false);
    } else {
      // hide room users since the room id is not defined
      roomUsersContainer.hide();
    }
  };

  /**
   * Generate room users DOM
   * @param roomUsers Users to render
   * @returns {string} The DOM representing the user
   */
  ChatApplication.prototype.renderRoomUsers = function () {
    // sort room users by status
    var users = TAFFY(chatApplication.chatRoom.users);
    var sortedRoomUsers = [];
    var sortedStatuses = ["available", "away", "donotdisturb", ["offline", "invisible"]];
    sortedStatuses.forEach(function (status) {
      users({status: status}).order("fullname").each(function (user) {
        sortedRoomUsers.push(user);
      });
    });

    var html = "";
    sortedRoomUsers.forEach(function (user) {
      if (user.name !== chatApplication.username) {
        html += chatApplication.renderRoomUser(user, chatApplication.showRoomOfflinePeople);
      }
    });
    jqchat("#room-users-list").html(html);
  };

  /**
   * Generate room user DOM
   * @param user User to render
   * @returns {string} The DOM representing the user
   */
  ChatApplication.prototype.renderRoomUser = function (user, showOfflineUsers) {
    var html = "";
    html += "<div class='room-user' data-name='" + user.name + "'"
    if (!showOfflineUsers && (user.status == 'offline' || user.status == 'invisible')) {
      html += "style='display: none;'";
    }
    html += ">";
    html += "  <div class='msUserAvatar pull-left'>";
    html += "    <span class='msAvatarLink avatarCircle'><img onerror=\"this.src='/chat/img/user-default.jpg'\" src='/" + eXo.env.portal.rest + "/v1/social/users/" + user.name + "/avatar' alt='" + user.fullname + "'></span>";
    html += "  </div>";
    html += "  <div class='room-user-status pull-right'>";
    html += "    <i class='user-" + user.status + "'></i>";
    html += "  </div>";
    html += "  <div class='room-user-name'>" + user.fullname + "</div>";
    html += "</div>"
    return html;
  };

  /**
   *
   * @param showPeople Show people if true, otherwise hide them
   */
  ChatApplication.prototype.toggleOfflineRoomUsers = function (showPeople) {
    var offlineUsers = jqchat("#room-users-list").find(".room-user-status .user-offline, .room-user-status .user-invisible").parents(".room-user");
    if (showPeople == true) {
      offlineUsers.show();
    } else {
      offlineUsers.hide();
    }
  };

  ChatApplication.prototype.sessionTimeout = function() {
    requireChatCometd(function (cCometD) {
      cCometD.explicitlyDisconnected = true;
      cCometD.disconnect();
    });

    var $msg = jqchat('#msg');
    $msg.attr("disabled", "disabled");
    showPopupWindow("session-timeout-window", true, true);
  };

  window.chatApplication = new ChatApplication();

  function alertError(msg, callback) {
    window.require(['SHARED/bootbox'], function(bootbox) {
      bootbox.alertError(msg, callback);
    })
  }

  function showPopupWindow() {
    var args = arguments;
    window.require(['SHARED/uiChatPopupWindow'], function(uiChatPopupWindow) {
      uiChatPopupWindow.show.apply(uiChatPopupWindow, args);
    });
  }

  function hidePopupWindow() {
    var args = arguments;
    window.require(['SHARED/uiChatPopupWindow'], function(uiChatPopupWindow) {
      uiChatPopupWindow.hide.apply(uiChatPopupWindow, args);
    });
  }

  function initTeamForm() {
    window.require(["SHARED/suggester"], function ($) {
      $('#team-add-user').suggester({
        type: 'tag',
        plugins: ['remove_button'],
        create: false,
        createOnBlur: false,
        highlight: false,
        openOnFocus: false,
        sourceProviders: ['exo:chatuser'],
        valueField: 'name',
        labelField: 'fullname',
        searchField: ['fullname', 'name'],
        closeAfterSelect: true,
        dropdownParent: "body",
        renderMenuItem: function (item, escape) {
          var avatar = "/rest/v1/social/users/" + item.name + "/avatar";
          return '<div class="avatarMini"><img src="' + avatar + '" onerror="this.src=\'/chat/img/Avatar.gif;\'" >&nbsp;</div>' +
            '<div class="text">' + escape(item.fullname) + ' (' + item.name + ')' + '</div>' +
            '<div class="user-status"><i class="chat-status-team chat-status-' + item.status + '"></i></div>';
        },
        sortField: [{field: 'order'}, {field: '$score'}],
        providers: {
          'exo:chatuser': function (query, callback) {
            if (!query.length) return callback();
            jqchat.ajax({
              url: chatApplication.jzUsers,
              data: {
                "filter": query,
                "user": chatApplication.username,
                "limit": 10,
                "dbName": chatApplication.dbName
              },
              headers: {
                'Authorization': 'Bearer ' + chatApplication.token
              },
              dataType: "json",
              context: chatApplication,
              error: function () {
                callback();
              },
              success: function (res) {
                var users = TAFFY(res.users);
                var users = users();
                users = users.filter({name: {"!is": chatApplication.username}});
                users = JSON.parse(users.stringify());
                callback(users);
              }
            });
          }
        }
      });
    }); // End suggester component
  }

  (function ($) {
    $(document).ready(function () {
      /**
       * Init Chat
       */
      var $chatApplication = $("#chat-application");

      chatApplication.username = $chatApplication.attr("data-username");
      chatApplication.token = $chatApplication.attr("data-token");
      chatApplication.fullname = $chatApplication.attr("data-fullname");
      chatApplication.isTeamAdmin = $chatApplication.attr("data-team-admin");
      chatApplication.chatIntervalSession = $chatApplication.attr("data-chat-interval-session");
      chatApplication.plfUserStatusUpdateUrl = $chatApplication.attr("data-plf-user-status-update-url");
      chatApplication.dbName = $chatApplication.attr("data-db-name");
      chatApplication.chatFullscreen = $chatApplication.attr("data-fullscreen");
      chatApplication.portalURI = $chatApplication.attr("data-portal-uri");
      chatApplication.uploadFileSize = $chatApplication.attr("data-upload-file-size");

      chatApplication.jzMaintainSession = $chatApplication.jzURL("ChatApplication.maintainSession");
      chatApplication.jzUpload = $chatApplication.jzURL("ChatApplication.upload");
      chatApplication.jzCreateEvent = $chatApplication.jzURL("ChatApplication.createEvent");
      chatApplication.jzSaveWiki = $chatApplication.jzURL("ChatApplication.saveWiki");

      var chatServerURL = $chatApplication.attr("data-chat-server-url");
      chatApplication.jzChatWhoIsOnline = chatServerURL + "/whoIsOnline";
      chatApplication.jzChatRead = chatServerURL + "/read";
      chatApplication.jzChatSendMeetingNotes = chatServerURL + "/sendMeetingNotes";
      chatApplication.jzChatGetMeetingNotes = chatServerURL + "/getMeetingNotes";
      chatApplication.jzChatGetRoom = chatServerURL + "/getRoom";
      chatApplication.jzChatGetCreator = chatServerURL + "/getCreator";
      chatApplication.jzChatToggleFavorite = chatServerURL + "/toggleFavorite";
      chatApplication.jzChatIsFavorite = chatServerURL + "/isFavorite";
      chatApplication.jzChatSetPreferredNotification = chatServerURL + "/setPreferredNotification";
      chatApplication.jzChatSetNotificationTrigger = chatServerURL + "/setNotificationTrigger";
      chatApplication.jzChatSetRoomNotificationTrigger = chatServerURL + "/setRoomNotificationTrigger";
      chatApplication.jzChatGetUserDesktopNotificationSettings = chatServerURL + "/getUserDesktopNotificationSettings";
      chatApplication.jzUsers = chatServerURL + "/users";
      chatApplication.jzDeleteTeamRoom = chatServerURL + "/deleteTeamRoom";
      chatApplication.jzSaveTeamRoom = chatServerURL + "/saveTeamRoom";
      chatApplication.room = "";

      // init chat application
      var $labelUser = jqchat(".uiGrayLightBox .label-user");
      if (window.innerWidth > 767) {
        $labelUser.text(chatApplication.fullname);
      } else {
        $labelUser.removeAttr("href").text("Discussion");
      }
      jqchat(".uiExtraLeftContainer .label-user").text(chatApplication.fullname);

      // Attach weemo call button into chatApplication
      chatApplication.displayVideoCallOnChatApp();

      /**
       * Init Global Variables
       *
       */
      //needed for #chat text area
      chatApplication.keydown = -1;
      //needed for #edit-modal-text area
      var keydownModal = -1;
      //needed for Fluid Integration
      var labelAvailable = $chatApplication.attr("data-label-available");
      var labelAway = $chatApplication.attr("data-label-away");
      var labelDoNotDisturb = $chatApplication.attr("data-label-donotdisturb");
      var labelInvisible = $chatApplication.attr("data-label-invisible");

      $("#chat-status").on('chat:connected', function (event, data) {
        jqchat('#chat-application').removeClass('offline');
      });

      $("#chat-status").on('chat:disconnected', function (event, data) {
        jqchat('#chat-application').addClass('offline');

        var msgs = chatApplication.chatRoom.getPendingMessages();
        if (msgs.length > 0) {
          var db = TAFFY(msgs);
          var rooms = db().distinct("room");

          rooms.forEach(function (id) {
            var room = chatApplication.rooms({room: id});
            room.update({hasLocalMsg: true});
          });

          chatApplication.renderRooms();
        }
      });

      chatApplication.initChat();

      $(window).focus(function() {
        if (chatApplication.chatRoom) {
          chatApplication.chatRoom.isFocus = true;
          chatApplication.chatRoom.updateUnreadMessages();
        }
      });

      $(window).blur(function() {
        if (chatApplication.chatRoom) {
          chatApplication.chatRoom.isFocus = false;
        }
      });

      /**
       * Handle Real Time communications events
       */
      requireChatCometd(function (cCometD) {
        cCometD.subscribe('/service/chat', null, function (event) {
          var message = event.data;
          if (typeof message != 'object') {
            message = JSON.parse(message);
          }

          if (message.event == 'logout-sent') {
            // if a logout has been issued for this user in one of his sessions,
            // we check if the current session is stil alive
            setTimeout(function(){
              jqchat.ajax({
                  url: eXo.env.portal.context + '/' + eXo.env.portal.rest + '/state/ping',
                  error: function (xhr, status, error) {
                      if (xhr.status == 403) {
                          chatApplication.sessionTimeout();
                      }
                  }
              });
            }, 1000);
          } else if (message.event == 'user-status-changed') {
            if (message.room == chatApplication.username) {
              // update current user status
              chatNotification.changeStatusChat(message.room, message.data.status);
            } else {
              // update rooms list
              chatApplication.rooms({type: 'u', user: message.room}).update({status: message.data.status});
              chatApplication.renderRooms();

              // update room users status if a room is selected
              if (chatApplication.chatRoom && chatApplication.chatRoom.users) {
                chatApplication.chatRoom.users.forEach(function (user, idx) {
                  if (user.name == message.room) {
                    chatApplication.chatRoom.users[idx].status = message.data.status;
                    chatApplication.renderRoomUsers();
                    return;
                  }
                });
              }
            }
          } else if (message.event == 'room-member-joined') {
            var room = message.data;

            // Add the new room and re-render the list of rooms
            chatApplication.rooms.insert({
              fullName: room.fullName,
              isActive: room.isActive,
              isFavorite: room.isFavorite,
              type: room.type,
              room: room.room,
              status: "team",
              timestamp: room.timestamp,
              unreadTotal: room.unreadTotal,
              user: room.user
            });
            chatApplication.renderRooms();
          } else if (message.event == 'room-member-left') {
            chatApplication.rooms({room: message.room}).remove();
            chatApplication.renderRooms();
          } else if (message.event == 'room-updated') {
            var room = chatApplication.rooms({room: message.room});
            room.update({fullName: message.data.title});
            chatApplication.renderRooms();

            if (chatApplication.chatRoom && chatApplication.chatRoom.id == message.room && chatApplication.chatRoom.users) {
              chatApplication.loadRoomUsers();
              chatApplication.targetFullname = message.data.title;
              jqchat("#chat-room-detail-fullname").text(message.data.title);
            }
          } else if (message.event == 'room-deleted') {
            var room = chatApplication.rooms({room: message.room});
            room.remove();
            chatApplication.renderRooms();
          } else if (message.event == 'room-settings-updated') {
            var settings = message.data.settings;
            var val = settings.notifConditionType + ':' + settings.notifCondition;
            desktopNotification.setRoomPreferredNotificationTrigger(message.room, val);//set into the memory
          } else if (message.event == 'message-read') {
            var room = chatApplication.rooms({room: message.room});
            room.update({unreadTotal: 0});
            chatApplication.renderRooms();
          } else if (message.event == 'message-sent') {
            chatApplication.rooms({room: message.room}).update({timestamp: new Date().getTime()});

            // Clean local messages here.
            chatApplication.chatRoom.removePendingMessage(message.data);

            if (chatApplication.chatRoom.id === message.room && chatApplication.configMode == false) {
              chatApplication.chatRoom.addMessage(message.data, true);

              if (chatApplication.chatRoom.isFocus === true) {
                chatApplication.chatRoom.updateUnreadMessages();
              }
            } else {
              var room = chatApplication.rooms({room: message.room});
              room.update({unreadTotal: (room.first().unreadTotal + 1)});
              chatApplication.renderRooms();
            }
          } else if (message.event == 'message-updated' || message.event == 'message-deleted') {
            if (chatApplication.chatRoom.id === message.room) {
              chatApplication.chatRoom.updateMessage(message.data);
            }
          } else if (message.event == 'favorite-added') {
            var room = chatApplication.rooms({user: message.room});
            room.update({isFavorite: true});
            chatApplication.renderRooms();
          } else if (message.event == 'favorite-removed') {
            var room = chatApplication.rooms({user: message.room});
            room.update({isFavorite: false});
            chatApplication.renderRooms();
          }
        });
      });


      /**
       ##################                           ##################
       ##################                           ##################
       ##################   JQUERY UI EVENTS        ##################
       ##################                           ##################
       ##################                           ##################
       */

      $("#PlatformAdminToolbarContainer").addClass("no-user-selection");

      $.fn.setCursorPosition = function (position) {
        if (this.length === 0) return this;
        return $(this).setSelection(position, position);
      };

      $.fn.setSelection = function (selectionStart, selectionEnd) {
        if (this.length === 0) return this;
        input = this[0];

        if (input.createTextRange) {
          var range = input.createTextRange();
          range.collapse(true);
          range.moveEnd('character', selectionEnd);
          range.moveStart('character', selectionStart);
          range.select();
        } else if (input.setSelectionRange) {
          input.focus();
          input.setSelectionRange(selectionStart, selectionEnd);
        }

        return this;
      };

      $.fn.focusEnd = function () {
        this.setCursorPosition(this.val().length);
        return this;
      };

      $(window).on("unload", function(e) {
        chatApplication.hidePanels();
      });

      $("#chats").on('chat:sendMessage', function (event, data) {
        var isOffline = $('#chat-application').hasClass('offline');
        if (isOffline) { // Offline
          var room = chatApplication.rooms({room: data.room, hasLocalMsg: {isUndefined: true}});
          if (room.count() > 0) {
            room.update({hasLocalMsg: true});
            chatApplication.renderRooms();
          }
        }
      });

      $('#msg').focus(function () {
        var chatheight = document.getElementById("chats");
        chatheight.scrollTop = chatheight.scrollHeight;
        chatApplication.chatRoom.updateUnreadMessages();
        chatheight.scrollHeight;
      });

      $('#msg').keydown(function (event) {
        //prevent the default behavior of the enter button
        if (event.which == 13) {
          event.preventDefault();
        }
        //adding (shift or ctl or alt) + enter for adding carriage return in a specific cursor
        if (event.keyCode == 13 && (event.shiftKey || event.ctrlKey || event.altKey)) {
          this.value = this.value.substring(0, this.selectionStart) + "\n" + this.value.substring(this.selectionEnd, this.value.length);
          var textarea = $('#msg');
          $('#msg').scrollTop(textarea[0].scrollHeight - textarea.height());
        }
        if (event.which == 18) {
          chatApplication.keydown = 18;
        }
      });

      $('#msg').keyup(function (event) {
        var msg = $(this).val();
        if (event.which === 13 && msg.trim().length >= 1) {
          if (!msg || event.keyCode == 13 && (event.shiftKey || event.ctrlKey || event.altKey)) {
            return false;
          }
          chatApplication.sendMessage(msg);

        }

        // UP Arrow
        if (event.which === 38 && msg.length === 0) {
          var $uimsg = jqchat(".msMy").find(".msg-text").last();
          // Check for the case of a deleted message.
          if (!$uimsg.hasClass('noEdit')) {
            chatApplication.openEditMessagePopup($uimsg.attr("id"));
          }
        }

        if (chatApplication.keydown === 18) {
          chatApplication.keydown = -1;
        }
      });

      $(document).on('click.meeting-action-toggle', function (e) {
        if ($(e.target).closest('.meeting-actions').length == 0 && $('.meeting-action-popup').css('display') == 'none') {
          $('.meeting-action-toggle').removeClass('active');
        }
      });


      $("#submit").on("click", function () {

        var msg = $("#msg").val();
        chatApplication.sendMessage(msg);
        $("#msg").val("");
        $("#msg, #msg_editable").focus();

      });


      $(".meeting-action-toggle").on("click", function () {
        if ($(this).hasClass("disabled")) return;

        if ($('.meeting-action-popup').css('display') == 'none') {
          $(this).toggleClass('active');
        }
        $(".meeting-action-popup").hide();
      });

      $(".meeting-action-link").on("click", function () {
        var toggleClass = $(this).attr("data-toggle");

        if (toggleClass === "meeting-action-flag-panel") return;

        $(".meeting-action-panel").hide();
        $(".input-with-value").each(function () {
          $(this).val($(this).attr("data-value"));
          $(this).addClass("input-default");
        });
        var $toggle = $("." + toggleClass);
        var pheight = $toggle.attr("data-height");
        var ptitle = $toggle.attr("data-title");

        var $popup = $(".meeting-action-popup");
        $popup.css("height", pheight + "px");
        $popup.css("top", (-Math.abs(pheight) - 4) + "px");
        $toggle.show();
        $(".meeting-action-title").html(ptitle);
        $popup.show();

        if (toggleClass === "meeting-action-event-panel") {
          if (chatApplication.targetUser.indexOf("team-") > -1) {
            chatApplication.getUsers(chatApplication.targetUser, function (users) { // Team chat room
              $("#chat-file-target-user").val(users);
            }, true);
          } else if (chatApplication.targetUser.indexOf("space-") == -1) { // 1:1 chat room
            $("#chat-file-target-user").val(chatApplication.username + "," + chatApplication.targetUser);
          }
        }

        if (toggleClass === "meeting-action-file-panel") {
          $("#chat-file-form").attr("action", chatApplication.jzUpload);
          $("#chat-file-room").val(chatApplication.room);
          $("#chat-file-target-user").val(chatApplication.targetUser);
          $("#chat-file-target-fullname").val(chatApplication.targetFullname);
          $("#chat-file-file").val("");
          $("#chat-file-file").off();

          chatApplication.getUsers(chatApplication.targetUser, function (users) {
            $(function () {
              var targetUser = chatApplication.targetUser;
              if (targetUser.indexOf("team-") > -1) {
                targetUser = users;
                $("#chat-file-target-user").val(targetUser);
              }
              $('.chatDropzone').remove();
              // Random ID for dropzone to avoid drop file on room twice
              // and to be able to reinitialize filedrop data parameters
              // dynmically
              var dropzoneId = 'dropzone' + chatApplication.room + Math.random().toString(36).substring(2, 15);
              $('#dropzone-container').html(
                  '<div class="progressBar" class="chatDropzone" id="' + dropzoneId + '">'
                + '<div class="progress">'
                + '<div class="bar" style="width: 0.0%;"></div>'
                + '<div class="label"><div class="label-inner">' + chatBundleData["exoplatform.chat.file.drop"] + '</div></div>'
                + '</div>'
                + '</div>'
              );
              window.require(['SHARED/filedrop'], function() {
                $('#' + dropzoneId).filedrop({
                  fallback_id: 'chat-file-file',   // an identifier of a standard file input element
                  url: chatApplication.jzUpload,              // upload handler, handles each file separately, can also be a function taking the file and returning a url
                  paramname: 'userfile',          // POST parameter name used on serverside to reference file
                  data: {
                    room: chatApplication.room,
                    targetUser: targetUser,
                    targetFullname: encodeURIComponent(chatApplication.targetFullname)
                  },
                  error: function (err, file) {
                    switch (err) {
                      case 'BrowserNotSupported':
                        alert(chatBundleData["exoplatform.chat.dnd.support"]);
                        break;
                      case 'TooManyFiles':
                        // user uploaded more than 'maxfiles'
                        break;
                      case 'FileTooLarge':
                        alert(chatBundleData["exoplatform.chat.upload.filesize"].replace("{0}", chatApplication.uploadFileSize));
                        // program encountered a file whose size is greater than 'maxfilesize'
                        // FileTooLarge also has access to the file which was too large
                        // use file.name to reference the filename of the culprit file
                        break;
                      case 'FileTypeNotAllowed':
                      // The file type is not in the specified list 'allowedfiletypes'
                      default:
                        break;
                    }
                  },
                  allowedfiletypes: [],   // filetypes allowed by Content-Type.  Empty array means no restrictions
                  maxfiles: 1,
                  maxfilesize: chatApplication.uploadFileSize,    // max file size in MBs
                  uploadStarted: function (i, file, len) {
                    console.log("upload started : " + i + " : " + file.name + " : " + len);
                    // a file began uploading
                    // i = index => 0, 1, 2, 3, 4 etc
                    // file is the actual file of the index
                    // len = total files user dropped
                  },
                  progressUpdated: function (i, file, progress) {
                    console.log("progress updated : " + i + " : " + file.name + " : " + progress);
                    $("#" + dropzoneId).find('.bar').width(progress + "%");
                    $("#" + dropzoneId).find('.bar').html(progress + "%");
                    // this function is used for large files and updates intermittently
                    // progress is the integer value of file being uploaded percentage to completion
                  },
                  uploadFinished: function (i, file, response, time) {
                    console.log("upload finished : " + i + " : " + file.name + " : " + time + " : " + response.status + " : " + response.name);
                    // response is the data you got back from server in JSON format.
                    var msg = response.name;
                    var options = response;
                    options.type = "type-file";
                    options.username = chatApplication.username;
                    options.fullname = chatApplication.fullname;
                    chatApplication.chatRoom.sendMessage(msg, options, "true", function () {
                      $("#" + dropzoneId).find('.bar').width("0%");
                      $("#" + dropzoneId).find('.bar').html("");
                      hideMeetingPanel();
                    });

                  }
                });
              });
            });


          }, true);

        }

        if (toggleClass === "meeting-action-task-panel") {
          $("#task-add-task").val("");
          $("#task-add-user").val("");
          $("#task-add-date").val("");
          $(".task-user-label").parent().remove();
          var $userResults = $(".task-users-results");
          $userResults.css("display", "none");
          $userResults.html("");
        } else if (toggleClass === "meeting-action-event-panel") {
          $("#event-add-summary").val("");
          $("#event-add-start-date").val("");
          $("#event-add-end-date").val("");
          $("#event-add-location").val("");
          $("#event-add-start-time").val("all-day");
          $("#event-add-end-time").val("all-day");

          window.require(['SHARED/uiMiniCalendar'], function(uiMiniCalendar) {
            ['event-add-start-date', 'event-add-end-date'].forEach(function(dateFieldId) {
              uiMiniCalendar.init(dateFieldId);
            });
          });
        }
      });

      function hideMeetingPanel() {
        $(".meeting-action-popup").css("display", "none");
        $(".meeting-action-toggle").removeClass("active");
      }

      $(".input-with-value").on("click", function () {
        if ($(this).hasClass("input-default")) {
          $(this).val("");
          $(this).removeClass("input-default");
        }
      });

      $(".input-with-value").on("focus", function () {
        if ($(this).hasClass("input-default")) {
          $(this).val("");
          $(this).removeClass("input-default");
        }
      });


      var handleGlobalNotifLayout = function () {
        jqchat("#chat-room-detail-fullname").html(chatBundleData["exoplatform.chat.settings.button.tip"]);
        desktopNotification.getPreferredNotification().forEach(function (prefNotif, index, array) {
          $("#global-config input[notif-type='" + prefNotif + "']").attr("checked", "checked");
        });
        desktopNotification.getPreferredNotificationTrigger().forEach(function (prefNotif, index, array) {
          $("#global-config input[notif-trigger='" + prefNotif + "']").attr("checked", "checked");
        });

        if (desktopNotification.getPreferredNotification().length === 0) { //if there is no preffered channel
          $("#global-config input[notif-trigger]").attr('disabled', true);
          $("#global-config input[notif-trigger]").parent().addClass("switchBtnDisabled");
        } else {
          $("#global-config input[notif-trigger]").removeAttr('disabled');
          $("#global-config input[notif-trigger]").parent().removeClass("switchBtnDisabled");
        }

        window.require(['SHARED/iphoneStyleCheckbox'], function() {
          jqchat('#global-config :checkbox').iphoneStyle({disabledClass: 'switchBtnDisabled', containerClass: 'uiSwitchBtn', labelOnClass: 'switchBtnLabelOn', labelOffClass: 'switchBtnLabelOff', handleClass: 'switchBtnHandle'});
        });

        chatApplication.enableMessageComposer(false);
        jqchat("#chat-team-button-dropdown").hide();
        jqchat("#userRoomStatus").removeClass("hide").show();
      };

      $(document).on("click", "#global-config #close-global-notif-config, #back", function () {//close the setting page and go for the previous screen
        jqchat("#global-config").remove();
        if (window.innerWidth <= 767) {

          jqchat("#chat-room-detail-avatar").css("display", "block");
          jqchat(".chat-message.footer").css("display", "block");
          jqchat(".uiLeftContainerArea").addClass("displayContent");

          jqchat(".uiGlobalRoomsContainer").removeClass("displayContent");
          setTimeout(function () {
            jqchat(".uiGlobalRoomsContainer").css("display", "none");
          }, 500);

          jqchat("#chats").css("min-height", "0");

          jqchat("#chat-room-detail-avatar, .chat-message.footer, #searchButtonResp").css("display", "block");
          jqchat("#userRoomStatus").removeClass("hide");

          $serachText = jqchat('#chat-search').attr('placeholder');
          if ($serachText.search("@") == -1) {
            jqchat("#chat-search").attr("placeholder", "@" + $serachText);
          }
        }
        chatApplication.loadRoom();
      });

      $(document).on("click", "#room-config #close-room-notif-config", function () {//close the setting page and go for the previous screen

        if (window.innerWidth > 767) {
          chatApplication.loadRoom();
        } else {
          jqchat("#chat-room-detail-avatar").css("display", "block");
          jqchat(".chat-message.footer").css("display", "block");
          jqchat(".uiLeftContainerArea").addClass("displayContent");
          jqchat(".uiGlobalRoomsContainer").css("display", "none");
          setTimeout(function () {
            jqchat(".uiGlobalRoomsContainer").removeClass("displayContent");
          }, 200);
          jqchat("#chats").css("min-height", "0");
        }
      });

      $(document).on("click", "#room-config input:radio[room-notif-trigger]", function (evt) {//choose a room trigger
        var roomTriggerType = jqchat(this).attr('room-notif-trigger');
        var roomTriggerWhenKeyWordValue = jqchat("#room-config #" + desktopNotification.ROOM_NOTIF_TRIGGER_WHEN_KEY_WORD_VALUE).val();

        if (desktopNotification.ROOM_NOTIF_TRIGGER_WHEN_KEY_WORD === roomTriggerType) {
          $("#room-config input#room-notif-trigger-when-key-word-value").prop('disabled', false);
        } else {
          $("#room-config input#room-notif-trigger-when-key-word-value").prop('disabled', true);
        }

        jqchat.ajax({
          url: chatApplication.jzChatSetRoomNotificationTrigger,
          data: {
            "user": chatApplication.username,
            "room": chatApplication.room,
            "notifCondition": roomTriggerWhenKeyWordValue,
            "notifConditionType": roomTriggerType,
            "dbName": chatApplication.dbName,
            "time": (new Date()).getTime()
          },
          headers: {
            'Authorization': 'Bearer ' + chatApplication.token
          },
          error: function (xhr, status, error) {
            console.log('an error has been occured', error);
          }

        });

      });

      $(document).on("keyup", "#room-config input[name='keyWords']", function (event) {//when entering keywords save them imediately
        console.log(event.target.value);
      });

      //global desktop notification settings
      $("#configButton, #configButtonResp").on("click", function () {
        if (jqchat("#global-config").length > 0) {
          return;
        }
        jqchat("#chat-video-button").css("display", "none");
        chatApplication.configMode = true;
        var $div = jqchat("#global-config-template");

        $div = $div.clone();
        $div.attr("id", "global-config");
        $div.css("display", "inline-block");

        var $chat = jqchat('#chats');
        $chat.html("");
        $chat.addClass("hide-messages");
        $div.appendTo('#chats');

        handleGlobalNotifLayout();

        if (window.innerWidth <= 767) {
          jqchat(".uiExtraLeftContainer").removeClass("displayContent");
          jqchat(".uiGlobalRoomsContainer").css("display", "block");

          setTimeout(function () {
            jqchat(".uiGlobalRoomsContainer").addClass("displayContent");
          }, 200);

          jqchat("#chat-room-detail-avatar, .chat-message.footer, #searchButtonResp").css("display", "none");
          jqchat("#userRoomStatus").addClass("hide");
          jqchat("#chats").css("min-height", window.innerHeight + "px");
        }
      });

      $("#menuButton").on("click", function () {

        $(".uiExtraLeftContainer").toggleClass("displayContent");

        var $chatStatusPanel = $(".chat-status-panel");

        $chatStatusPanel.css("display", "none");
        $(" .chat-status-chat").parent().removeClass('active');

      });
      $(".uiExtraLeftContainer > .bg, .uiExtraLeftContainer > .uiExtraLeftGlobal > .close").on("click", function () {
        $(".uiExtraLeftContainer").removeClass("displayContent");

        var $chatStatusPanel = $(".chat-status-panel");

        $chatStatusPanel.css("display", "none");
        $(" .chat-status-chat").parent().removeClass('active');

      });

      $("#searchButton, #searchButtonResp").on("click", function () {
        $("#chat-application .uiGrayLightBox .uiSearchInput").toggleClass("displayContent");

        var $chatStatusPanel = $(".chat-status-panel");

        $chatStatusPanel.css("display", "none");
        $(" .chat-status-chat").parent().removeClass('active');
      });
      $("#chat-application .uiSearchForm .uiIconClose").on("click", function () {
        $("#chat-application .uiGrayLightBox .uiSearchInput").removeClass("displayContent");
        $('input#chat-search.input-with-value.span4').val('');
        var filter = $('input#chat-search.input-with-value.span4').val();
        chatApplication.search(filter);
      });

      //team/room desktop notification settings
      $("#team-notification-button").on("click", function () {
        if (jqchat("#room-config").length > 0) {
          return;
        }
        chatApplication.configMode = true;
        chatApplication.enableMessageComposer(false)
        var $div = jqchat("#room-config-template");

        $div = $div.clone();
        $div.attr("id", "room-config");
        $div.css("display", "inline-block");

        var $chat = jqchat('#chats');
        $chat.html("");
        $chat.addClass("hide-messages");
        $div.appendTo('#chats');

        chatNotification.loadSetting(function () {
          jqchat("#chat-room-detail-fullname").html(chatApplication.targetFullname + " " + chatBundleData["exoplatform.stats.notifications"]);
          var roomPrefTrigger = desktopNotification.getRoomPreferredNotificationTrigger()[chatApplication.room];
          if (roomPrefTrigger) {
            if (roomPrefTrigger === desktopNotification.ROOM_NOTIF_TRIGGER_NORMAL ||
              roomPrefTrigger === desktopNotification.ROOM_NOTIF_TRIGGER_SILENCE) {
              $("#room-config input#room-notif-trigger-when-key-word-value").prop('disabled', true);
              $("#room-config input[room-notif-trigger='" + roomPrefTrigger + "']").attr("checked", "checked");
            } else {
              $("#room-config input#room-notif-trigger-when-key-word-value").prop('disabled', false);
              $("#room-config input[room-notif-trigger='" + desktopNotification.ROOM_NOTIF_TRIGGER_WHEN_KEY_WORD + "']").attr("checked", "checked");
              var keywords = roomPrefTrigger.split(":")[1];
              $("#room-config input[id='" + desktopNotification.ROOM_NOTIF_TRIGGER_WHEN_KEY_WORD_VALUE + "']").val(keywords);
            }
          } else {
            $("#room-config input#room-notif-trigger-when-key-word-value").prop('disabled', true);
          }
          $("#room-config input#room-notif-trigger-when-key-word-value").unbind("blur");
          $("#room-config input#room-notif-trigger-when-key-word-value").blur(function (evt) {
            $("#room-config input[room-notif-trigger='" + desktopNotification.ROOM_NOTIF_TRIGGER_WHEN_KEY_WORD + "']").click();
          });
        }, false);

        jqchat("#chat-room-detail-avatar, #searchButtonResp").css("display", "none");
      });

      $(document).on("click touchstart", "#global-config div.notif-manner div.uiSwitchBtn", function () {
        var notifManner = $(this).find('input[notif-type]').attr("notif-type");
        jqchat.ajax({
          url: chatApplication.jzChatSetPreferredNotification,
          data: {
            "user": chatApplication.username,
            "notifManner": notifManner,
            "dbName": chatApplication.dbName
          },
          headers: {
            'Authorization': 'Bearer ' + chatApplication.token
          },

          success: function (operation) {
            operation = JSON.parse(operation);
            if (operation.done) {
              desktopNotification.setPreferredNotification(notifManner);//set into the memory
              handleGlobalNotifLayout();
            } else {
              console.log("Request received but operation done without success..");
            }
          },
          error: function (xhr, status, error) {
            console.log('an error has been occured', error);
          }

        });
      });

      $(document).on("click touchstart", "#global-config div.notif-trigger div.uiSwitchBtn", function () {
        if ($(this).hasClass("switchBtnDisabled")) {//if the checkbox are disabled
          return;
        }
        var notifTrigger = $(this).find('input[notif-trigger]').attr("notif-trigger");
        jqchat.ajax({
          url: chatApplication.jzChatSetNotificationTrigger,
          data: {
            "user": chatApplication.username,
            "notifCondition": notifTrigger,
            "dbName": chatApplication.dbName
          },
          headers: {
            'Authorization': 'Bearer ' + chatApplication.token
          },

          success: function (operation) {
            operation = JSON.parse(operation);
            if (operation.done) {
              desktopNotification.setPreferredNotificationTrigger(notifTrigger);//set into the memory
              handleGlobalNotifLayout();
            } else {
              console.log("Request received but operation done without success..");
            }
          },
          error: function (xhr, status, error) {
            console.log('an error has been occured', error);
          }

        });
      });


      $(".meeting-close-panel").on("click", function () {
        hideMeetingPanel();
      });

      $(".btnClosePopup").on("click", function () {
        hideMeetingPanel();
      });

      $(".share-link-button").on("click", function () {
        var $uiText = $("#share-link-text");
        var text = $uiText.val();
        if (text === "" || text === $uiText.attr("data-value")) {
          return;
        }

        // if user has not entered http:// https:// or ftp:// assume they mean http://
        if (!/^(https?|ftp):\/\//i.test(text)) {
          text = 'http://' + text; // set both the value
        }

        // Validate url
        var isValid = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&amp;'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&amp;'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&amp;'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&amp;'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&amp;'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(text);
        if (!isValid) {
          alertError(chatBundleData["exoplatform.chat.link.invalid.message"], function (e) {
            e.stopPropagation();
            $("#share-link-text").select();
          });
          return;
        }

        var options = {
          type: "type-link",
          link: text,
          from: chatApplication.username,
          fullname: chatApplication.fullname
        };
        var msg = "";

        chatApplication.chatRoom.sendMessage(msg, options, "true");
        hideMeetingPanel();

        $("i.uiIconPLF24x24Search.search_chatIcon.btn").on("click", function () {
          $("#chat-search, #chat-searchResp, #chat-application").toggleClass("open_searchChat");
        });


      });


      $(".raise-hand-button").on("click", function () {
        var $uiText = $("#raise-hand-comment-text");
        var text = $uiText.val();
        if (text === $uiText.attr("data-value")) {
          text = "";
        }

        var options = {
          type: "type-hand",
          from: chatApplication.username,
          fullname: chatApplication.fullname
        };
        var msg = text;

        chatApplication.chatRoom.sendMessage(msg, options, "true");
        hideMeetingPanel();

      });

      $(".question-button").on("click", function () {
        var $uiText = $("#question-text");
        var text = $uiText.val();
        if (text === "" || text === $uiText.attr("data-value")) {
          return;
        }

        var options = {
          type: "type-question",
          from: chatApplication.username,
          fullname: chatApplication.fullname
        };
        var msg = text;

        chatApplication.chatRoom.sendMessage(msg, options, "true");
        hideMeetingPanel();

      });

      $('.uiRightContainerArea').on('dragenter', function () {
        $("#meeting-action-upload-link").trigger("click");
      });

      $(".chat-status-chat").parent().on("click", function () {
        var $chatStatusPanel = $(".chat-status-panel");
        if ($chatStatusPanel.css("display") === "none") {
          $chatStatusPanel.css("display", "inline-block");
          $(this).addClass('active');
        }
        else {
          $chatStatusPanel.css("display", "none");
          $(this).removeClass('active');
        }
      });

      $("li.chat-menu").click(function () {
        var status = $(this).attr("status");
        chatApplication.setStatus(status, function () {
          $(".chat-status-panel").css('display', 'none');
          $(".chat-status-chat").parent().removeClass('active');
        });
      });

      $(".msg-emoticons").on("click", function () {
        if ($(this).parent().hasClass("disabled")) return;

        var $msgEmoticonsPanel = $(".msg-emoticons-panel");
        if ($msgEmoticonsPanel.css("display") === "none") {
          $(this).parent().addClass('active');
          $msgEmoticonsPanel.css("display", "inline-block");
        }

        else {
          $msgEmoticonsPanel.css("display", "none");
          $(this).parent().removeClass('active');
        }
      });

      $(".emoticon-btn").on("click", function () {
        var sml = $(this).attr("data");
        $(".msg-emoticons-panel").css("display", "none");
        $msg = $('#msg');
        var val = $msg.val();
        if (val.charAt(val.length - 1) !== ' ') val += " ";
        val += sml + " ";
        $msg.val(val);

        if (!chatApplication.$mentionEditor) {
          $msg.focusEnd();
        } else {
          var el = $msg.next('div');
          val = el.html().replace(/<br>/g, '');
          val = el.html().replace(/&nbsp;/g, ' ');
          el.html(val + sml + " ");
        }
        $(".msg-emoticons").parent().removeClass("active");

      });

      $('#chat-search, #chat-searchResp').keyup(function (event) {
        if (event.keyCode == 27 || event.which == 27) {
          $(this).val('');
        }
        var filter = $(this).val();
        chatApplication.search(filter);
      });

      function setActionButtonEnabled(btnClass, isEnabled) {
        if (isEnabled) {
          $(btnClass).css('cursor', "default");
          $(btnClass).removeAttr('disabled');
        } else {
          $(btnClass).css('cursor', "progress");
          $(btnClass).attr('disabled', 'disabled');
        }
      };

      $(".create-event-button").on("click", function () {
        var space = chatApplication.targetFullname;
        var summary = $("#event-add-summary").val();
        var startDate = $("#event-add-start-date").val();
        var startTime = $("#event-add-start-time").val();
        var endDate = $("#event-add-end-date").val();
        var endTime = $("#event-add-end-time").val();
        var location = $("#event-add-location").val();
        if (space === "" || startDate === "" || startTime === "" || endDate === "" || endTime === "" || summary === "" || summary === $("#event-add-summary").attr("data-value") || location === "" || location === $("#event-add-location").attr("data-value")) {
          alertError(chatBundleData["exoplatform.chat.event.invalid.entry"]);
          return;
        }
        window.require(['SHARED/uiMiniCalendar'], function(uiMiniCalendar) {
          if (!uiMiniCalendar.isDate(startDate)) {
            alertError(chatBundleData["exoplatform.chat.date.invalid.message"], function (e) {
              e.stopPropagation();
              $("#event-add-start-date").select();
            });
            return;
          }
          if (!uiMiniCalendar.isDate(endDate)) {
            alertError(chatBundleData["exoplatform.chat.date.invalid.message"], function (e) {
              e.stopPropagation();
              $("#event-add-end-date").select();
            });
            return;
          }
        });
        if (Date.parse(startDate) > Date.parse(endDate)) {
          alertError(chatBundleData["exoplatform.chat.compareddate.invalid.message"], function (e) {
            e.stopPropagation();
            $("#event-add-start-date").select();
          });
          return;
        }
        if (startTime === "all-day") startTime = "12:00 AM";
        if (endTime === "all-day") endTime = "11:59 PM";
        var users = "";
        var targetUser = chatApplication.targetUser;
        if (targetUser.indexOf("space-") == -1) {
          users = $("#chat-file-target-user").val();
        }
        hideMeetingPanel();
        setActionButtonEnabled('.create-event-button', false);

        $.ajax({
          url: chatApplication.jzCreateEvent,
          data: {
            "space": space,
            "users": users,
            "summary": summary,
            "startDate": startDate,
            "startTime": startTime,
            "endDate": endDate,
            "endTime": endTime,
            "location": location
          },
          success: function (response) {

            var options = {
              type: "type-event",
              summary: summary,
              space: space,
              startDate: startDate,
              startTime: startTime,
              endDate: endDate,
              endTime: endTime,
              location: location
            };
            var msg = summary;

            chatApplication.chatRoom.sendMessage(msg, options, "true");
            setActionButtonEnabled('.create-event-button', true);

          },
          error: function (xhr, status, error) {
            setActionButtonEnabled('.create-event-button', true);
          }
        });
      });

      $("#event-add-start-time").on("change", function () {
        var time = $(this).val();
        var h = Math.round(time.split(":")[0]) + 1;
        var hh = h;
        if (h < 10) hh = "0" + h;
        $("#event-add-end-time").val(hh + ":" + time.split(":")[1]);
      });

      ['#event-add-start-time', '#event-add-end-time'].forEach(function(id) {
        var select = $(id);
        for (var h = 0; h < 24; h++) {
          for (var m = 0; m < 60; m += 30) {
            var hh = h;
            var mm = m;
            var h12 = h % 12 || 12;
            var hh12 = h12;
            var ampm = h < 12 ? "AM" : "PM";
            if (h < 10) hh = "0" + hh;
            if (m < 10) mm = "0" + mm;
            if (h12 < 10) hh12 = "0" + hh12;
            var time = hh + ":" + mm;
            var time12 = hh12 + ":" + mm + " " + ampm;
            select.append('<option value="' + time12 + '">' + time12 + '</option>');
          }
        }
      });

      $("#team-edit-button").on("click", function () {
        // Only the room owner can manage room users and can see the System popup.
        // We do a check to be sure the current user is the room owner.
        if (chatApplication.username === chatApplication.chatRoom.owner) {
          // Clear and reset form
          window.require(["SHARED/suggester"], function ($) {
            initTeamForm();

            var selectize = $('#team-add-user')[0].selectize;
            selectize.clear();

            var users = TAFFY(chatApplication.chatRoom.users);
            users = users();
            users.order("fullname").each(function (user, number) {
              if (user.name !== chatApplication.username) {
                selectize.addOption(user);
                selectize.addItem(user.name);
              }
            });
          });

          var title = chatApplication.rooms({room: chatApplication.room}).first().fullName;
          var $uitext = $("#team-modal-name");
          $uitext.val(title);
          $uitext.attr("data-id", chatApplication.room);

          showPopupWindow("team-modal-form", true);
          jqchat("#team-modal-form .popupTitle").text(chatBundleData['exoplatform.chat.team.settings.title'])
          $uitext.focus();

          // Set form position to screen center
          chatApplication.setModalToCenter('.team-modal');
        }
      });

      $("#team-delete-button").on("click", function (e) {
        jqchat("#team-delete-window-chat-name").text(chatBundleData["exoplatform.chat.team.delete.message"].replace("{0}", chatApplication.targetFullname));
        showPopupWindow("team-delete-window", true, true);
      });

      $("#team-delete-button-ok").on("click", function () {
        hidePopupWindow("team-delete-window", true);
        jqchat("#team-delete-window-chat-name").empty();
        chatApplication.deleteTeamRoom(function () {
          chatApplication.chatRoom.emptyChatZone();
          jqchat("#users-online-team-" + chatApplication.room).hide();
          chatApplication.room = "";
          chatApplication.chatRoom.id = "";
        });

        if (window.innerWidth <= 767) {
          jqchat(".uiLeftContainerArea").addClass("displayContent");
          jqchat(".uiLeftContainerArea").removeClass("hideContent");

          jqchat(".uiGlobalRoomsContainer").addClass("hideContent").removeClass("displayContent");

          setTimeout(function () {
            jqchat(".uiGlobalRoomsContainer").css("display", "none");
          }, 500);
        }

      });

      $("#team-delete-button-cancel").on("click", function () {
        hidePopupWindow("team-delete-window", true);
        jqchat("#team-delete-window-chat-name").empty();
      });

      $(".team-settings-modal-close").on("click", function () {
        hidePopupWindow("team-settings-modal-view", true);
      });

      $("#chat-record-button").on("click", function () {
        var $icon = $(this).children("i");

        var msgType = $icon.hasClass("uiIconChatRecordStart") ? "type-meeting-start" : "type-meeting-stop";
        var options = {
          type: msgType,
          fromUser: chatApplication.username,
          fromFullname: chatApplication.fullname
        };

        var msg = "";

        chatApplication.chatRoom.sendMessage(msg, options, "true");
      });

      $(".team-modal-cancel").on("click", function () {
        hidePopupWindow("team-modal-form", true);
        var $uitext = $("#team-modal-name");
        $uitext.val("");
        $uitext.attr("data-id", "---");
      });

      $(".team-modal-save").on("click", function () {
        var $uitext = $("#team-modal-name");
        var teamName = $uitext.val();
        if ($.trim(teamName) === "") {
          $uitext.focus();
          return;
        }
        var teamId = $uitext.attr("data-id");
        hidePopupWindow("team-modal-form", true);

        var users = chatApplication.username + ',' + $('#team-add-user').val();

        chatApplication.saveTeamRoom(teamName, teamId, users, function(data) {
          // if it is a new room...
          if(teamId === "---") {
            // select it
            $(".users-online span[room-data='" + data.room + "']").click();
          }
        });

        $uitext.val("");
        $uitext.attr("data-id", "---");
      });

      $(".text-modal-close").on("click", function () {
        $('.text-modal').modal('hide');
      });

      $(".edit-modal-cancel").on("click", function () {
        $('.edit-modal').modal('hide');
        jqchat("#msg").focus();
        $("#edit-modal-area").val("");
      });

      $(".edit-modal-save").on("click", function () {
        var $uitext = $("#edit-modal-area");
        var id = $uitext.attr("data-id");
        var message = $uitext.val();
        $uitext.val("");
        $('.edit-modal').modal('hide');

        chatApplication.editMessage(id, message, function (id, newMessage) {
          jqchat("#msg").focus();
        });
      });

      $('#edit-modal-area').keydown(function (event) {
        //prevent the default behavior of the enter button
        if (event.which == 13) {
          event.preventDefault();
        }
        //adding (shift or ctl or alt) + enter for adding carriage return in a specific cursor
        if (event.keyCode == 13 && (event.shiftKey || event.ctrlKey || event.altKey)) {
          this.value = this.value.substring(0, this.selectionStart) + "\n" + this.value.substring(this.selectionEnd, this.value.length);
          var textarea = jqchat(this);
          jqchat(this).scrollTop(textarea[0].scrollHeight - textarea.height());
        }
        if (event.which == 18) {
          keydownModal = 18;
        }
      });

      $('#edit-modal-area').keyup(function (event) {
        var id = $(this).attr("data-id");
        var msg = $(this).val();

        if (keydownModal === 18) {
          keydownModal = -1;
        } else if (event.which === 13 && msg.length > 1) {
          if (!msg || event.keyCode == 13 && (event.shiftKey || event.ctrlKey || event.altKey)) {
            return false;
          }
          $(".edit-modal-save").click();
        }

        // press Escape
        if (event.which === 27) {
          $('.edit-modal').modal('hide');
          jqchat("#msg").focus();
        }
      });


      if (window.fluid !== undefined) {
        this.chatSessionInt = clearInterval(this.chatSessionInt);
        this.chatSessionInt = setInterval(jqchat.proxy(this.maintainSession, this), this.chatIntervalSession);
      }

      function initFluidApp() {
        if (window.fluid !== undefined) {
          window.fluid.addDockMenuItem(labelAvailable, chatApplication.setStatusAvailable);
          window.fluid.addDockMenuItem(labelAway, chatApplication.setStatusAway);
          window.fluid.addDockMenuItem(labelDoNotDisturb, chatApplication.setStatusDoNotDisturb);
          window.fluid.addDockMenuItem(labelInvisible, chatApplication.setStatusInvisible);
        }
      }

      initFluidApp();

      function reloadWindow() {
        var sURL = unescape(window.location.href);
        window.location.href = sURL;
      }

      // We change the current history by removing get parameters so they won't be visible in the popup
      // Having a location bar with ?noadminbar=true is not User Friendly ;-)
      function removeParametersFromLocation() {
        var sURL = window.location.href;
        if (sURL.indexOf("?") > -1) {
          sURL = sURL.substring(0, sURL.indexOf("?"));
          window.history.replaceState("#", "Chat", sURL);
        }
      }

      String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
      };

      $("#room-users-btn-offline").on("click", function () {
        chatApplication.showRoomOfflinePeople = !chatApplication.showRoomOfflinePeople;
        // toggle button state
        var showRoomOfflinePeopleButton = $(this);
        if (chatApplication.showRoomOfflinePeople == true) {
          showRoomOfflinePeopleButton.addClass("active");
          showRoomOfflinePeopleButton.attr("title", showRoomOfflinePeopleButton.attr("data-title-active"));
        } else {
          showRoomOfflinePeopleButton.removeClass("active");
          showRoomOfflinePeopleButton.attr("title", showRoomOfflinePeopleButton.attr("data-title-inactive"));
        }
        showRoomOfflinePeopleButton.tooltip("fixTitle");
        showRoomOfflinePeopleButton.tooltip("show");
        // toggle offline users visibility
        chatApplication.toggleOfflineRoomUsers(chatApplication.showRoomOfflinePeople);
      });

      $("#room-users-collapse-bar, .participantsList").on("click", function () {
        // toggle room users
        var roomUsersContainer = $(".uiRoomUsersContainerArea");
        var roomUsersHeaderTitle = roomUsersContainer.find("#room-users-title");
        var collpaseBarIcon = $(this).children("i");
        var allContacts = $("#room-users-button > ul > li:nth-child(1)");

        if (roomUsersContainer.is(".room-users-expanded")) {
          roomUsersContainer.removeClass("room-users-expanded");
          roomUsersContainer.addClass("room-users-collapsed");
          collpaseBarIcon.removeClass("uiIconArrowRight uiIconArrowDefault");
          collpaseBarIcon.addClass("uiIconArrowLeft");
        } else {
          roomUsersContainer.removeClass("room-users-collapsed");
          roomUsersContainer.addClass("room-users-expanded");
          collpaseBarIcon.removeClass("uiIconArrowLeft uiIconArrowDefault");
          collpaseBarIcon.addClass("uiIconArrowRight");

          allContacts.css("display", "block");
        }
      });
      $("#closeListPart").on("click", function () {

        var roomUsersContainer = $(".uiRoomUsersContainerArea");
        var collpaseBarIcon = $(this).children("i");
        var allContacts = $("#room-users-button > ul > li:nth-child(1)");
        roomUsersContainer.removeClass("room-users-expanded");
        roomUsersContainer.addClass("room-users-collapsed");
        collpaseBarIcon.removeClass("uiIconArrowRight uiIconArrowDefault");
        collpaseBarIcon.addClass("uiIconArrowLeft");
        allContacts.css("display", "none");


      });

      /* ADDING @ TO Search placeholder */
      if (window.innerWidth <= 767) {
        $serachText = $('#chat-search').attr('placeholder');
        $("#chat-search").attr("placeholder", "@" + $serachText);
      }

    });
  })(jqchat);
})($, desktopNotification, chatRoom, taffy);
