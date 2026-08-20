# Show HN draft

## Title

Show HN: Yapfeed, short public-domain audio that keeps playing

## First comment

My partner suggested an audio version of a short-form feed for people who want entertainment while resting their eyes. I built the listener half first.

Yapfeed starts a queue with one press, moves to the next short piece automatically, offers a large skip control and Space shortcut, and has a 10, 20 or 30 minute sleep timer. It currently streams 58 credited LibriVox recordings from five public-domain Internet Archive collections. Listening needs no account; likes and skips stay in local storage.

It does not have profiles, follows, comments, direct messages or automatic publishing. A submitted clip is only an HTTPS link of 60 seconds or less and remains pending until a human reviews it. Yapfeed does record an anonymous session hash with completed or skipped clip events so I can measure completion rate and clips per session.

Media Session handlers are present, but I have not yet completed a physical locked-phone test across browsers and operating systems. I do not want to claim reliable screen-off playback until that test passes.

I would value feedback on three things: whether the queue feels varied enough for a 15-minute listen, whether the controls work well with a screen reader or without looking, and which browser/device combinations keep playing after the screen locks.

https://s72-yapfeed.pages.dev
