import {WebAudioAPI} from "./WebAudioAPI/build/lib/webAudioAPI";

(function () {
   const audioAPI = new WebAudioAPI();
   const I32_MAX = 2147483647;
   let syncStart = 0;
   let midiDevices = ['---MIDI---'], midiInstruments = [], audioDevices = ['---AUDIO---'];
   let lastRecordedClip = null, recordingInProgress = false, currentDeviceType;
   audioAPI.createTrack('default');
   audioAPI.start();
   const availableEffects = audioAPI.getAvailableEffects();
   const availableMidiNotes = audioAPI.getAvailableNotes();
   const availableNoteDurations = audioAPI.getAvailableNoteDurations();
   audioAPI.getAvailableMidiDevices().then(returnMidiDevice, fail);
   audioAPI.getAvailableAudioInputDevices().then(returnAudioDevice, fail);

   const devRoot = 'http://localhost:8000/extensions/BeatsBlox/instruments/';
   const releaseRoot = 'https://extensions.netsblox.org/extensions/BeatsBlox/instruments/';
   const instrumentLocation = window.origin.includes('localhost') ? devRoot : releaseRoot;

    audioAPI.getAvailableInstruments(instrumentLocation).then(
        instruments => instruments.forEach(
            instrument => midiInstruments.push(instrument)
        )
    );

  
    /**
     * Object representing a mapping between an encoding file type and its unique internal code.
     * @constant {Object.<string, number>}
     */
    const EncodingType = {
        WAV: 1
    };



    /**
     * Object representing a mapping between an effect type and its unique internal code.
     * @constant {Object.<string, number>}
     */
    const EffectType = {
        Reverb: 11, Delay: 12, Echo: 13,                                                 // Time-Based Effects
        Chorus: 21, Tremolo: 22, Vibrato: 23, Flanger: 24, Phaser: 25,                   // Modulation Effects
        Panning: 31, Equalization: 32,                                                   // Spectral Effects
        Volume: 41, Compression: 42, Distortion: 43,                                     // Dynamic Effects
        LowPassFilter: 51, HighPassFilter: 52, BandPassFilter: 53, BandRejectFilter: 54  // Filter Effects
    };

    const EffectsPreset = {
        'Under Water': ['LowPassFilter', {
            ['cutoffFrequency']: 500,
            ['resonance']: 12,
        }],
        'Telephone': ['HighPassFilter', {
            ['cutoffFrequency'] : 1800,
            ['resonance']: 10,
        }],
        'Cave': ['Echo', {
            ['feedback'] : 0.5,
            ['intensity'] : 0.4,
        }],
        'Fan Blade': ['Tremolo', {
            ['tremeloFrequency'] : 18,
        }],
    }

    /**
     * Creates a list of all available MIDI devices
     * @param {[String]} devices - available MIDI device.
     */
    function returnMidiDevice(devices) {
        midiDevices = midiDevices.concat(devices);
        console.log(devices);
    }

    /**
     * Creates a list of all available audio-input devices
     * @param {[String]} devices - available audio-input devices.
     */
    function returnAudioDevice(devices) {
        audioDevices = audioDevices.concat(devices);
        console.log(devices);
    }

    /**
     * Runs when the audio API can't return a list of available devices.
     */
    function fail() {
        console.log('something went wrong');
    }

    /**
     * Connects a MIDI device to the WebAudioAPI
     * @param {String} trackName - Name of the Track 
     * @param {String} device - Name of the MIDI device being connected.
     */
    function midiConnect(trackName, device) {
        if (device != "") {
            audioAPI.connectMidiDeviceToTrack(trackName, device).then(() => {
                console.log('Connected to MIDI device!');
            });
            // audioAPI.registerMidiDeviceCallback(device, midiCallback);
            currentDeviceType = 'midi';
        }
    }

    /**
     * Connects and audio input device to NetsBlox
     * @param {String} trackName - Name of the Track 
     * @param {String} device - Name of the audio device being connected.
     */
    function audioConnect(trackName,device) {
        if (device != "") {
            audioAPI.connectAudioInputDeviceToTrack(trackName, device).then(() => {
                console.log('Connected to audio device!');
            });
            currentDeviceType = 'audio';
        }
    }

    /**
     * Connects an instrument sample to the WebAudioAPI
     * @param {String} trackName - Name of the Track 
     * @param {String} instrument - Name of instrument being loaded.
     */
    function changeInsturment(trackName,instrument) {
        audioAPI.updateInstrument(trackName, instrument).then(() => {
            console.log('Instrument loading complete!');
        });
    }

    /**
     * Exports an AudioClip as an audio file.
     * @async
     * @param {AudioClip} clip - the clip being exported.
     * @param {String} format - the format of the file being created.
     */
    async function exportClip(clip, format) {
        const wavLink = document.getElementById("wav-link");
        const blob = await clip.getEncodedData(EncodingType[format]);
        wavLink.href = URL.createObjectURL(blob, { type: "audio/wav" });
        wavLink.click();
    }

    /**
     * Converts an AudioClip k to a Snap! Sound.
     * @asyn
     * @param {AudioClip} clip - The clip being rendered.
     * @returns A Snap! Sound.
     */
    async function clipToSnap(clip) {
        const blob = await clip.getEncodedData(EncodingType['WAV']);
        const audio = new Audio(URL.createObjectURL(blob, { type: "audio/wav" }));
        return new Sound(audio, 'netsblox-sound');
    }

    /**
     * Disconnects all audio and midi devices from NetsBlox
     * @param {String} trackName - name of the Track 
     * @async
     */
    async function disconnectDevices(trackName) {
        console.log('device disconnected');
        if (audioDevices.length > 0)
            await audioAPI.disconnectAudioInputDeviceFromTrack(trackName);
        if (midiDevices.length > 0)
            await audioAPI.disconnectMidiDeviceFromTrack(trackName);
    }

    function base64toArrayBuffer(base64){
        var binaryString = window.atob(base64.replace("data:audio/mpeg;base64,", ""));
        var bytes = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async function synchronize(){
        let currentStart = syncStart++;
        await wait(.005)
        do {
            currentStart++;
            await wait(.005);
        } while (currentStart != syncStart);
        audioAPI.start();
    }

    async function playAudio(binaryString, trackName){
        await synchronize();  
        const buffer = base64toArrayBuffer(binaryString.audio.src);
        audioAPI.start();
        return audioAPI.playClip(trackName, buffer, audioAPI.getCurrentTime(),0);
    }

    async function playAudioForDuration(binaryString, trackName, dur){
        await synchronize();
        const buffer = base64toArrayBuffer(binaryString.audio.src);
        audioAPI.start();
        return audioAPI.playClip(trackName, buffer,audioAPI.getCurrentTime(),  dur);
    }

    async function setTrackPanning(trackName, level){
        const effectOptions = { ["leftToRightRatio"]:Number(level)};
        // await audioAPI.applyTrackEffect(trackName,"Panning",availableEffects["Panning"]);
        await audioAPI.updateTrackEffect(trackName,"Panning",effectOptions);
    }

    async function applyTrackEffect(trackName, effectName){
      await audioAPI.applyTrackEffect(trackName,effectName,availableEffects[effectName]);
    
    }

    async function setTrackEffect(trackName, effectName, level){
        const effectType = availableEffects[effectName];
        const parameters = audioAPI.getAvailableEffectParameters(effectType);
        const effectOptions = {[Object.values(parameters).name] : level}
        console.log(`HERE ARE THE PARAMETERS ${trackName}:`, effectOptions);
        // await audioAPI.updateTrackEffect(trackName,effectName,effectOptions);
    }

    function createTrack(trackName){
        audioAPI.createTrack(trackName);
    }

    function stopAudio(){
        audioAPI.stop();
        audioAPI.clearAllTracks();
    }

    async function masterVolume(percent){
        const effectOptions = { ["intensity"]:Number(percent)};
        await audioAPI.updateMasterEffect(trackName,"Volume",effectOptions);
    }
    async function trackVolume(trackName, percent){
        const effectOptions = { ["intensity"]:Number(percent)};
        await audioAPI.updateTrackEffect(trackName,"Volume",effectOptions);
    }
    function  beatsPerMinute(bpm){
        return audioAPI.updateBeatsPerMinute(bpm);
    }
    async function addFxPreset(track, effect) {
        const effectName = EffectsPreset[effect][0];
        await audioAPI.applyTrackEffect(track, effectName, EffectType[effectName]);
        const effectOptions = EffectsPreset[effect][1];
        await audioAPI.updateTrackEffect(track, effectName, effectOptions);
    }

    function vizualize(binaryString){
        const buffer = base64toArrayBuffer(binaryString.audio.src);
        const wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#4F4A85',
            progressColor: '#383351',
            media: buffer,
          })
    }

    async function wait(duration) {
        return new Promise(resolve => {
            setTimeout(resolve, duration * 1000);
        })
    }
    // ----------------------------------------------------------------------
    class MusicApp extends Extension {
        constructor(ide) {
            super('MusicApp');
            this.ide = ide;
            const oldStopAllActiveSounds = StageMorph.prototype.runStopScripts;
            StageMorph.prototype.runStopScripts = function(){
                oldStopAllActiveSounds.call(this);
                stopAudio();
            }
            this.ide.hideCategory("sound");
        }


        onOpenRole() {
            for (var i =0; i <this.ide.sprites.contents.length; i++){
               createTrack(this.ide.sprites.contents[i].id);
            }
        }

        onNewSprite(sprite){
            createTrack(sprite.id);
        }

        getMenu() { return {}; }

        getCategories() {
            return [
                new Extension.Category('music', new Color(148,0,211)),
            ];
        }

        getPalette() {
            const blocks = [
                new Extension.Palette.Block('playAudioClip'),
                new Extension.Palette.Block('playAudioClipforDuration'),
                new Extension.Palette.Block('stopClips'),
                new Extension.Palette.Block('masterVolume'),
                new Extension.Palette.Block('trackVolume'),
                new Extension.Palette.Block('setGlobalBPM'),
                new Extension.Palette.Block('setTrackPanning'),
                new Extension.Palette.Block('applyTrackEffect'),
                new Extension.Palette.Block('setTrackEffect'),
                new Extension.Palette.Block('presetEffect'),
                new Extension.Palette.Block('setInputDevice'),
                new Extension.Palette.Block('setInstrument'),
                new Extension.Palette.Block('startRecording'),
                new Extension.Palette.Block('recordForDuration'),
                new Extension.Palette.Block('stopRecording'),
                //new Extension.Palette.Block('exportAudio'),
                new Extension.Palette.Block('playNote'),
                new Extension.Palette.Block('getLastRecordedClip'),
            ];
            return [
                new Extension.PaletteCategory('music', blocks, SpriteMorph),
                new Extension.PaletteCategory('music', blocks, StageMorph),
            ];
        }

        getBlocks() {
            function block(name, type, category, spec, defaults, action) {
                return new Extension.Block(name, type, category, spec, defaults, action)
            }
            return [
                block('playAudioClip', 'command', 'music', 'play audio clip %s', ['clip'], function (audioBuffer){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        const duration = await playAudio(audioBuffer, trackName);
                        await wait(duration-.02);
                    },{ args: [], timeout: I32_MAX });
                }),
                block('playAudioClipforDuration', 'command', 'music', 'play audio clip for duration %n %s', ['1', 'clip'], function (dur,audioBuffer){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        const duration = await playAudioForDuration(audioBuffer, trackName, dur);
                        await wait(duration-Math.max(.02,0));
                    },{ args: [], timeout: I32_MAX });
                }),
                block('playNote', 'command', 'music', 'play note %midiNotes for %noteDurations', ['', ''], function (note,noteDuration){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        const blockduration = await audioAPI.playNote(trackName,availableMidiNotes[note], audioAPI.getCurrentTime(), availableNoteDurations[noteDuration]);
                        await wait(blockduration);
                    },{ args: [], timeout: I32_MAX });
                }),
                block('stopClips', 'command', 'music', 'stop all clips', [], function (){
                    stopAudio();
                    this.doStopAll();
                }),
                block('masterVolume', 'command', 'music', 'master volume %n %', ['80'], function (percent){
                    masterVolume(percent * 0.01);
                }),
                block('trackVolume', 'command', 'music', 'track volume %n %', ['50'], function (percent){
                    const trackName = this.receiver.id;
                    trackVolume(trackName,percent* 0.01);
                }),
                block('setGlobalBPM', 'command', 'music','set global BPM %n', ['120'], function (bpm){
                    beatsPerMinute(bpm);
                }),
                block('setTrackPanning', 'command', 'music','set track panning %n', ['0.5'], function (level){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        await setTrackPanning(trackName, level);
                  
                    },{ args: [], timeout: I32_MAX });
                }),
                block('applyTrackEffect', 'command', 'music','apply track %effects effect', [], function (effectName){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        await applyTrackEffect(trackName, effectName);
                    },{ args: [], timeout: I32_MAX });
                }),
                block('setTrackEffect', 'command', 'music','set track %effects effect to %n', ['','0'], function (effectName, level){
                    this.runAsyncFn(async () =>{
                        const trackName = this.receiver.id;
                        await setTrackEffect(trackName, effectName, level);
                    },{ args: [], timeout: I32_MAX });
                }),
                block('presetEffect', 'command', 'music', 'preset effects %fxPreset %onOff', ['', 'on'], function (effect, status) {
                    const trackName = this.receiver.id;
                    if (effect != '') {
                        if (status == 'on') {
                            this.runAsyncFn(async () => {
                                await addFxPreset(trackName, effect);
                            });
                        } else {
                            const effectName = EffectsPreset[effect][0];
                            this.runAsyncFn(async () => {
                                await audioAPI.removeTrackEffect(trackName, effectName)
                            });
                        }
                    } else {
                        throw Error('must select an effect');
                    }         
                }),
                block('setInputDevice', 'command', 'music', 'set input device: %inputDevice', [''], function (device) {
                    const trackName = this.receiver.id;
                    const isDeviceHeader = (device === '---MIDI---' || device === '---AUDIO---');

                    if (device === '') 
                        this.runAsyncFn(async () => {
                            disconnectDevices(trackName);
                        }, { args: [], timeout: I32_MAX });
                    else if (midiDevices.indexOf(device) != -1 && !isDeviceHeader)
                        midiConnect(trackName, device);
                    else if (audioDevices.indexOf(device != -1) && !isDeviceHeader)
                        audioConnect(trackName, device);
                    else
                        throw Error('device not found');

                    if (midiInstruments.length > 0)
                        audioAPI.updateInstrument(trackName, midiInstruments[0]).then(() => {
                            console.log('default instrument set');
                        });
                    else
                        console.log('no default instruments');
                }),
                block('startRecording', 'command', 'music', 'start recording', [], function () {
                    const trackName = this.receiver.id;
                    switch (currentDeviceType) {
                        case 'midi':
                            lastRecordedClip = audioAPI.recordMidiClip(
                                trackName, audioAPI.getCurrentTime()
                            );
                            break;
                        case 'audio':
                            lastRecordedClip = audioAPI.recordAudioClip(
                                trackName, audioAPI.getCurrentTime()
                            );
                            break;
                    }
                    recordingInProgress = true;
                }),
                block('recordForDuration', 'command', 'music', 'record for %n seconds', [0], function (time) {
                    const trackName = this.receiver.id;
                    switch (currentDeviceType) {
                        case 'midi':
                            lastRecordedClip = audioAPI.recordMidiClip(
                                trackName, audioAPI.getCurrentTime(), time
                            );
                            break;
                        case 'audio':
                            lastRecordedClip = audioAPI.recordAudioClip(
                                trackName, audioAPI.getCurrentTime(), time
                            );
                            break;
                    }
                    recordingInProgress = true;
                }),
                block('setInstrument', 'command', 'music', 'set instrument %webMidiInstrument', [''], function(instrument) {
                    const trackName = this.receiver.id;
                    changeInsturment(trackName,instrument);
                }),
                block('stopRecording', 'command', 'music', 'stop recording', [], function() {
                    this.runAsyncFn(async () => {
                        await lastRecordedClip.finalize();
                    }, { args: [], timeout: I32_MAX });
                    recordingInProgress = false;
                }),
                // block('exportAudio', 'command', 'music', 'export %s as %fileFormats', ['clip'], function (clip, format) {
                //     this.runAsyncFn(async () => {
                //         await exportClip(clip, format);
                //     }, { args: [], timeout: I32_MAX });
                // }),
                block('getLastRecordedClip', 'reporter', 'music', 'get last recorded clip', [], function () {
                    if (recordingInProgress)
                        throw Error('recording in progress');
                    else if (lastRecordedClip == null)
                        throw Error('no clip found');
                    else
                        return this.runAsyncFn(async () => {
                            return await clipToSnap(lastRecordedClip);
                        }, { args: [], timeout: I32_MAX });
                }),
            ];
        }
        getLabelParts() { 
            function identityMap(s) {
                const res = {};
                for (const x of s) res[x] = x;
                return res;
            }
            function unionMaps(maps) {
                const res = {};
                for (const map of maps) {
                    for (const key in map) res[key] = map[key];
                }
                return res;
            }
            return [
            new Extension.LabelPart('bpmNotes', () => new InputSlotMorph(
                null, //text
                false, // numeric
                unionMaps([
                    identityMap([ 'Whole', 'Half', 'Quarter', 'Eighth', 'Sixteenth', 'Thirtysecondth']),
                ]),
                true,
            )),
            new Extension.LabelPart('enabled', () => new InputSlotMorph(
                null, //text
                false, //numeric
                unionMaps([
                    identityMap(['Enabled', 'Disabled']),
                ]),
                true,
            )),
            new Extension.LabelPart('effects', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(Object.keys(availableEffects)),
                true, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('midiNotes', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(Object.keys(availableMidiNotes)),
                true, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('noteDurations', () => new InputSlotMorph(
                null, //text
                false, //numeric
                identityMap(Object.keys(availableNoteDurations)),
                true, //readonly (no arbitrary text)
            )),
            new Extension.LabelPart('fxPreset', () => new InputSlotMorph(
                null, // text
                false, //numeric
                identityMap(['Under Water', 'Telephone', 'Cave', 'Fan Blade']),
                true, // readonly (no arbitrary text)
            )),
            new Extension.LabelPart('onOff', () => new InputSlotMorph(
                null, // text
                false, //numeric
                identityMap(['on', 'off']),
                true, // readonly (no arbitrary text)
            )),
            new Extension.LabelPart('webMidiInstrument', () => new InputSlotMorph(
                null, // text
                false, //numeric
                identityMap(midiInstruments),
                true, // readonly (no arbitrary text)
            )),
            new Extension.LabelPart('fileFormats', () => new InputSlotMorph(
                null, // text
                false, //numeric
                identityMap(['WAV']),
                true, // readonly (no arbitrary text)
            )),
            new Extension.LabelPart('inputDevice', () => new InputSlotMorph(
                null, // text
                false, //numeric
                identityMap(midiDevices.concat(audioDevices)),
                true, // readonly (no arbitrary text)
            )),
        ];           
    }

    }
    var element = document.createElement('link');
	element.setAttribute('rel', 'stylesheet');
	element.setAttribute('type', 'text/css');
	element.setAttribute('href', 'https://gsteinltu.github.io/PseudoMorphic/style.css');
	document.head.appendChild(element);

	var scriptElement = document.createElement('script');

	scriptElement.onload = () => {
		var element = createDialog('MusicApp');
		// const canvas = document.createElement('canvas');
		// canvas.id = 'roboscape-canvas';
		// element.querySelector('content').appendChild(canvas);
        element.querySelector('content').innerHTML = 
                    '<div id="waveform"></div><script type="module">import WaveSurfer from \'https://unpkg.com/wavesurfer.js@beta\' const wavesurfer = WaveSurfer.create({container: \'#waveform\', waveColor: \'violet\', progressColor: \'purple\'});      wavesurfer.once(\'interaction\', () => {wavesurfer.play()})</script>';
        setupDialog(element);
		window.externalVariables['musicAppDialog'] = element;
	};
	scriptElement.setAttribute('src', 'https://gsteinltu.github.io/PseudoMorphic/script.js');
	document.head.appendChild(scriptElement);

    NetsBloxExtensions.register(MusicApp);
})();