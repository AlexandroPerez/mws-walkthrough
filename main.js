// TODO: set to last section played by user using iDB
var gId = 1;
var noVideo = false;

document.addEventListener('DOMContentLoaded', event => {
  getData()
    .then(showList)
    .then(showLast);

  // Add menu event listener
  const menu = document.getElementById('menu');
  menu.onclick = function(e) {
    const nav = document.getElementById('nav');
    nav.classList.toggle('show');
  };

  window.onpopstate = function(e) {
    if (e.state) {
      const video = e.state;
      focusLink(video);
      return Promise.resolve(video)
        .then(clearContent)
        .then(embedVideo);
    }
  }

  // add nav menu list event listener
  const nav = document.getElementById('nav');
  nav.onclick = function(e) {
    // Only hide nav menu in small devices.
    if (window.innerWidth <= 800) this.classList.toggle('show');
  };
});

function getData() {
  const pathname = location.pathname;
  return fetch(`${pathname}data/chapters.json`).then(response => {
    if (!response.ok) return Promise.reject("fetch failed");
    return response.json();
  });
}

function getMDText(filename) {
  const pathname = location.pathname;
  return fetch(`${pathname}data/${filename}`).then(response => {
    if (!response.ok) return Promise.reject("fetch to MD file failed");
    return response.text();
  });
}


/**
 * Display list of chapters and their video lectures in the navigation. Returns the latest video
 * lecture to open (stored in a cookie), or the first video lecture.
 *
 * @param {Array} chapters An array of chapter objects, each containing video lecture objects
 */
function showList(chapters) {
  // store the video lecture to show here. Current ways to load a video are, in priority order:
  // 1. by search params first. If found save cookie.
  // 2. by a cookie, getting the last opened lecture. No need to change cookie.
  // 3. a default to 1.1. Save a cookie.
  let vidToOpen;

  //TODO: check if url has search params to load a specific lecture when page is loaded.
  const _404 = {_404: true, href: "https://youtu.be/KuLFXr7OPpc", title: "404 Lecture not found", md: "404.md"};
  if (location.search.length > 0) {
    // This will match search params that start with something like "?1.13."
    const validReg = /^\?\d+\.\d+\./;
    if ( validReg.test(location.search) ) {
      const [chapter, lecture] = location.search.substring(1).split('.');
      // First check if chapter actually exists, then try to fetch lecture. If anything fails, undefined is returned.
      vidToOpen = chapters[chapter -1] ? chapters[chapter -1].videos[lecture -1] : undefined;
      if (!vidToOpen) {
        // if the search params match the format, but the lecture doesn't exist return a 404 message in vidToOpen
        vidToOpen = _404;
      } else {
        // video lecture in search params was found, so set a cookie
        docCookies.setItem("latest", `{"chapter": ${chapter}, "lecture": ${lecture}}`);
        // and include chapter in video lecture
        vidToOpen.chapter = chapter;
      }
    } else {
      // if we have search params but they aren't valid return a 404 message
      vidToOpen = _404;
    }
  }

  // Get cookie for latest seen lecture, or set it if page is visited for the first time.
  // TODO: warn about cookie usage?
  let latest;
  // if no video lecture is set by url, OR if the video isn't a 404 message video.
  if (!vidToOpen || !vidToOpen._404) {
    latest = docCookies.getItem('latest');
    // if there is no cookie, meaning a first visit, set it and default to chapter 1 lecture 1
    if (!latest) {
      latest = {chapter: 1, lecture: 1};
      docCookies.setItem("latest", JSON.stringify(latest) );
    } else {
      latest = JSON.parse(latest);
    }
  } else {
    latest = {}; // set latest to an empty object, since thi
  }

  const nav = document.getElementsByTagName('nav')[0];
  // store video lecture to return here. Check against the latest chapter/lecture stored in cookie.

  chapters.forEach(chapter => {
    // If the latest chapter matches, store the video so it can be returned.
    if (!vidToOpen && chapter.id === latest.chapter ) {
      vidToOpen = chapter.videos[latest.lecture -1];
      vidToOpen.chapter = chapter.id;
    }

    const div = document.createElement('div');
    div.id = `chapter-${chapter.id}`;
    div.innerHTML = `${chapter.title} <i class="fas fa-angle-down"></i>`;
    // If this is the latest chapter, add class .chapter-open, so dropdown shows as open
    // the actual list is open below.
    if (chapter.id === latest.chapter) div.classList.add('chapter-open');
    div.onclick = function(e) {
      e.stopPropagation();
      this.classList.toggle('chapter-open');
      const chapterList = document.getElementById(`chapter-${chapter.id}-list`);
      chapterList.classList.toggle('hide-list');
      chapterList.classList.toggle('show-list');
    };
    nav.appendChild(div);

    const ul = document.createElement('ul');
    ul.id = `chapter-${chapter.id}-list`;
    // If current chapter is the latest read chapter, show the list of lectures, otherwise hide it.
    (chapter.id === latest.chapter)? ul.classList.add('show-list') : ul.classList.add('hide-list');
    chapter.videos.forEach(video => {
      video.chapter = chapter.id; // store the chapter this video belongs to in object.

      const li = document.createElement('li');

      const handleClick = function(e) {
        e.preventDefault();
        const prev = document.getElementsByClassName('active')[0];
        if (prev) prev.classList.remove('active');
        this.classList.toggle('active');
        // pushState to history saving the video as the stage, with the href as the url
        if (history.pushState) {
          window.history.pushState(video,'',this.href);
        }
        const latest = {chapter: chapter.id, lecture: video.id}
        docCookies.setItem('latest', JSON.stringify(latest));
        return Promise.resolve(video)
          .then(clearContent)
          .then(embedVideo);
      };
      const slug = video.title.toLowerCase().replace(/ -/g, "").replace(/,/g, "").replace(/ /g, "-");
      const url = `${location.origin}${location.pathname}?${chapter.id}.${video.id}.${slug}`;
      const a = document.createElement('a');
      a.href = url;
      // Links should include the chapter in the id.
      a.id = `${chapter.id}.${video.id}`;
      a.onclick = handleClick;
      a.innerText = `${video.id}. ${video.title}`;
      li.appendChild(a);

      ul.appendChild(li);
    });
    nav.appendChild(ul);

  });

  // once we get the video to show, replace the state so it can be in the history
  // This needs to be done so that the first page load replaces the default null state
  // and if user navigates back, the video will be shown when a popstate is triggered.
  if (history.replaceState) {
    window.history.replaceState(vidToOpen,'',location.href);
  }

  return vidToOpen;
}

function showLast(video) {
  embedVideo(video);
  if (!video._404) focusLink(video);
}

function embedVideo(video) {
  const title = document.getElementById('video-title');
  title.innerText = `${video.title}`;
  title.scrollIntoView();

  const link = video.href.split('/');
  const videoId = link[link.length - 1];

  const iframe = document.getElementById('player');
  if (!noVideo) iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&amp;showinfo=0`;

  const mdContainer = document.getElementById('md');
  mdContainer.innerHTML = "";

  getMDText(video.md).then(text => {
    const converter = new showdown.Converter();
    converter.setFlavor('github');
    const html = converter.makeHtml(text);
    mdContainer.innerHTML = html;

    starOnGithub = document.createElement('div');
    starOnGithub.id = 'star-github';
    starOnGithub.innerHTML = `<p>If you find this walkthrough helpful, please take a moment to <a href="https://github.com/AlexandroPerez/mws-walkthrough" target="_blank">star&nbsp;it&nbsp;on&nbsp;GitHub</a>&nbsp;😉</p>`;

    mdContainer.appendChild(starOnGithub);
  }).then(highlightCode);
}

function highlightCode() {
  const blocks = [].slice.call(document.querySelectorAll("pre code"));
  blocks.forEach(block => {
    let html = block.innerHTML;

    // Add custom highlighting by replacing custom opening and ending tags
    let regOp = /~mark\\/g; // matches ~mark\
    let regEd = /\\mark~/g; // matches \mark~
    html = html.replace(regOp, "<mark>").replace(regEd, "</mark>");

    block.innerHTML = html;

    hljs.highlightBlock(block);
  });
};

function focusLink(video) {
  const prev = document.getElementsByClassName('active')[0];
  if (prev) prev.classList.remove('active');

  const id = `${video.chapter}.${video.id}`
  const link = document.getElementById(id);
  link.classList.add('active');
  link.focus();
}

function clearContent(video) {
  const githubButton = document.getElementById('github-button');

  const content = document.getElementById('content');
  content.innerHTML = "";
  
  content.appendChild(githubButton);

  const h2 = document.createElement('h2');
  h2.id = "video-title";
  content.appendChild(h2);

  const iframe = document.createElement('iframe');
  iframe.id = "player";
  iframe.frameBorder = 0;
  iframe.allowFullscreen = true;
  iframe.setAttribute("allow", "autoplay; encrypted-media");
  content.appendChild(iframe);

  const markdown = document.createElement('div');
  markdown.id ="md";
  markdown.className = "markdown-body";
  content.appendChild(markdown);

  return video;
}
