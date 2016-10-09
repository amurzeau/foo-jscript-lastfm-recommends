var lastFMPlaylist = -1;
var currentPlaylistItem = plman.GetPlayingItemLocation();
var queryInProgress = false;

var CONFIG_MINIMUM_COUNT = "Minimum music count";
var CONFIG_ACCOUNT = "Account";

if(!window.GetProperty(CONFIG_MINIMUM_COUNT))
	window.SetProperty(CONFIG_MINIMUM_COUNT, 5);

if(!window.GetProperty(CONFIG_ACCOUNT)) {
	var account = "";
	window.SetProperty(CONFIG_ACCOUNT, account);
}


for(var i = 0; i < plman.PlaylistCount; i++) {
	if(plman.GetPlaylistName(i) == "LastFM") {
		lastFMPlaylist = i;
		break;
	}
}

if(lastFMPlaylist != -1)
	fb.trace("Found LastFM playlist at index " + lastFMPlaylist);
else
	currentPlaylistItem = null;

if(currentPlaylistItem && currentPlaylistItem.IsValid)
	fb.trace("Playing item " + currentPlaylistItem.PlaylistItemIndex);
	
function updateLastFM() {
	if(lastFMPlaylist == -1) {
		fb.trace("updateLastFM : not LastFM playlist");
		return;
	}
	
	var missingCount = window.GetProperty(CONFIG_MINIMUM_COUNT) - plman.PlaylistItemCount(lastFMPlaylist);
	if(missingCount > 0 && !queryInProgress) {
		queryInProgress = true;
		fb.trace("Creating REST request for " + missingCount + " items");
		var xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
		xmlhttp.open("GET", "http://www.last.fm/player/station/user/" + encodeURIComponent(window.GetProperty(CONFIG_ACCOUNT)) + "/mix?ajax=1");
		xmlhttp.onreadystatechange = function() {
			if(xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				var data = JSON.parse(xmlhttp.responseText);
				var missingCount = window.GetProperty(CONFIG_MINIMUM_COUNT) - plman.PlaylistItemCount(lastFMPlaylist);
				var itemNum = data.playlist.length > missingCount ? missingCount : data.playlist.length;
				fb.trace("Received results: " + data.playlist.length + " keeping only " + itemNum);
				var urlList = [];
				for(var i = 0; i < itemNum; i++) {
					var p = data.playlist[i];
					if(p.playlinks.length > 0) {
						var url;
						var title = "fb2k_title=" + encodeURIComponent(p.name);
						var artist;
						
						for(var j = 0; j < p.playlinks.length; j++) {
							 if(p.playlinks[j].affiliate == "youtube") {
								url = p.playlinks[j].url;
								break;
							}
						}
						
						if(!url) {
							fb.trace("No url !");
							continue;
						}
						
						if(p.artists.length > 0)
							artist = "fb2k_artist=" + encodeURIComponent(p.artists[0].name);
							
						if(title)
							url += "&" + title;
						
						if(artist)
							url += "&" + artist;
							
							
						fb.trace("Adding item " + i + " " + url);
						urlList.push(url);
					}
				}
				if(urlList.length > 0) {
					plman.AddLocations(lastFMPlaylist, urlList);
					queryInProgress = false;
				}
			} else if(xmlhttp.readyState == 4) {
				fb.trace("Failed to retrieve recommendations, state: " + xmlhttp.readyState + " status: " + xmlhttp.status);
			}
		};
		xmlhttp.setRequestHeader('User-Agent', "foobar2000_script");
		xmlhttp.send();
	}
}

function setCurrentTrack() {
	var playingItem = plman.GetPlayingItemLocation();
	if(!playingItem.IsValid) {
		fb.trace("playing item invalid");
		return;
	}
	
	currentPlaylistItem = null;
	
	if(lastFMPlaylist != -1 && lastFMPlaylist == playingItem.PlaylistIndex) {
		currentPlaylistItem = playingItem;
		fb.trace("Playing LastFM item " + currentPlaylistItem.PlaylistIndex);
	} else {
		fb.trace("playlist is not LastFM");
	}
}

function removeCurrentTrack() {
	if(lastFMPlaylist == -1 || !currentPlaylistItem || !currentPlaylistItem.IsValid) {
		fb.trace("current playlist item invalid");
		return;
	}
	
	var playingItem = plman.GetPlayingItemLocation();
	
	if(playingItem.IsValid && playingItem.PlaylistIndex == lastFMPlaylist && currentPlaylistItem.PlaylistItemIndex == playingItem.PlaylistItemIndex) {
		fb.trace("dont remove same item");
		return;
	}
	
	if(playingItem.IsValid && playingItem.PlaylistIndex != lastFMPlaylist) {
		fb.trace("Not playing LastFM anymore, keep item");
		return;
	}
	
	fb.trace("Checking remove: " + plman.PlaylistItemCount(lastFMPlaylist));
	if(plman.PlaylistItemCount(lastFMPlaylist) > currentPlaylistItem.PlaylistItemIndex) {
		fb.trace("Removing " + currentPlaylistItem.PlaylistItemIndex);
		plman.ClearPlaylistSelection(lastFMPlaylist);
		plman.SetPlaylistSelectionSingle(lastFMPlaylist, currentPlaylistItem.PlaylistItemIndex, true);
		plman.RemovePlaylistSelection(lastFMPlaylist, false);
		
		currentPlaylistItem = null;
		
		updateLastFM();
	}
}

function on_playback_new_track(handle) {
	fb.trace("on_playback_new_track");
	removeCurrentTrack();
	setCurrentTrack();
}

function on_playback_starting(cmd, is_paused) {
	fb.trace("on_playback_starting " + cmd);
	if(cmd != 2)
		currentPlaylistItem = null;
}

function on_playlist_switch() {
	if(lastFMPlaylist == -1 || plman.ActivePlaylist != lastFMPlaylist)
		return;
		
	updateLastFM();
}

function on_playlist_items_removed(playlistIndex, new_count) {
	fb.trace("on_playlist_items_removed " + playlistIndex);
	if(lastFMPlaylist != playlistIndex)
		return;

	setCurrentTrack();
	
	updateLastFM();
}
