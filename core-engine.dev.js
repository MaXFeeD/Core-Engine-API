var CORE_ENGINE_VERSION = "2.0";
var CORE_ENGINE_API_LEVEL = 10;
var CORE_ENGINE_CONFIG_LOCK = 4;

function getMcContext() {
    return MCSystem.getContext();
}

function getPlayerX() {
    return Player.getX();
}
function getPlayerY() {
    return Player.getY();
}
function getPlayerZ() {
    return Player.getZ();
}

String.prototype.startsWith = function(str) {
    return (this.indexOf(str) == 0);
};

var nonSavesObjectSaver = Saver.registerObjectSaver("nonSavesObjectSaver", {
	read: function() { return null; },
	save: function() { return null; }
});

var GuiUtils = {};
GuiUtils.Run = function(func) {
	MCSystem.runAsUi(function() {
		try {
			func();
		} catch (e) {
			Logger.Log("exception occurred in runOnUiThread (GuiUtils.Run)", "ERROR");
			Logger.LogError(e);
		}
	});
};



var FileTools = {
	mntdir: "/mnt",
	root: android.os.Environment.getExternalStorageDirectory().getAbsolutePath() + "/",
	moddir: __packdir__ + "innercore/mods/"
};

FileTools.mkdir = function(dir) {
	var file = new java.io.File(this.getFullPath(dir));
	file.mkdirs();
};
FileTools.mkworkdirs = function() {
	this.mkdir(this.moddir);
};
FileTools.getFullPath = function(path) {
	path = new String(path);
	if (path.startsWith(this.root) || path.startsWith(this.mntdir))
		return path;
	return this.root + path;
};
FileTools.isExists = function(path) {
	var file = new java.io.File(this.getFullPath(path));
	return file.exists();
};

FileTools.WriteText = function(file, text, add) {
	var dir = this.getFullPath(file);
	var writer = new java.io.PrintWriter(new java.io.BufferedWriter(new java.io.FileWriter(dir, add || false)));
	writer.write(text);
	writer.close();
};
FileTools.ReadText = function(file) {
	var dir = this.getFullPath(file);
	try {
		var reader = java.io.BufferedReader(new java.io.FileReader(dir));
		var str;
        var text = "";
        while (str = reader.readLine())
            text += str + "\n";
        return text;
    } catch (e) {
        return null;
    }
};
FileTools.WriteImage = function(file, bitmap) {
    var output = new java.io.FileOutputStream(this.getFullPath(file));
    bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output);
};

FileTools.ReadImage = function(file) {
    var options = new android.graphics.BitmapFactory.Options();
    options.inScaled = false;
    try {
		return android.graphics.BitmapFactory.decodeFile(this.getFullPath(file), options);
    } catch (e) {
        return null;
    }
};
FileTools.ReadTextAsset = function(name) {
    var bytes = Resources.getBytes(name);
    return bytes ? new java.lang.String(bytes) : null;
};
FileTools.ReadImageAsset = function(name) {
    var bytes = Resources.getBytes(name);
    var options = new android.graphics.BitmapFactory.Options();
    options.inScaled = false;
    return bytes ? android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options) : null;
};
FileTools.ReadBytesAsset = function(name) {
    return Resources.getBytes(name) || null;
};

FileTools.GetListOfDirs = function(path) {
    var dir = new java.io.File(this.getFullPath(path));
    var list = [];
    var files = dir.listFiles();
    if (!files) return list;
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.isDirectory())
            list.push(file);
    }
    return list;
};
FileTools.GetListOfFiles = function(path, ext) {
    var dir = new java.io.File(this.getFullPath(path));
    var list = [];
    var files = dir.listFiles();
    if (!files) {
        return list;
    }
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (!file.isDirectory()) {
            if (!ext || file.getName().endsWith(ext))
                list.push(file);
        }
    }
    return list;
};

FileTools.ReadKeyValueFile = function(dir, specialSeparator) {
    var separator = specialSeparator || ":";
    var text = this.ReadText(dir);
    if (!text) return {};
    var lines = text.split("\n");
    var result = {};
    for (var i in lines) {
        var line = lines[i];
        var separatedLine = line.split(separator);
        if (separatedLine.length == 2) result[separatedLine[0]] = separatedLine[1];
    }
    return result;
};
FileTools.WriteKeyValueFile = function(dir, data, specialSeparator) {
    var separator = specialSeparator || ":";
    var saves = [];
    for (var key in data)
        saves.push(key + separator + data[key]);
    var text = saves.join("\n");
    this.WriteText(dir, text);
};
FileTools.ReadJSON = function(dir) {
    var textFile = this.ReadText(dir);
    try {
        return JSON.parse(textFile) || {};
    } catch (e) {
        return {};
    }
};
FileTools.WriteJSON = function(dir, obj, beautify) {
    obj = obj || {};
    var textFile = JSON.stringify(obj, null, beautify ? "\t" : null);
    this.WriteText(dir, textFile);
};

FileTools.mkworkdirs();



var Threading = {
	threads: []
};

Threading.formatFatalErrorMessage = function(error, name, priority, formatFunc) {
    var paragraf = "Fatal error detected in thread " + name + ", all mods on this thread shutted down. Exit world safely and restart.\n\nКритическая ошибка в потоке " + name + ", все моды в этом потоке отключены. Для безопасного выхода сохраните мир и перезапуститесь.\n\n";
    paragraf += "CRASH INFO:\n";
    if (formatFunc) {
        paragraf += formatFunc(error, priority);
    } else {
        paragraf += "thread name: " + name + "\nthread priority:" + priority;
    }
    paragraf += "\n\nERROR DETAILS: \n";
    paragraf += "mod: " + error.fileName + "\n";
    paragraf += "line: " + error.lineNumber + "\n";
    paragraf += "stacktrace: <font color='#CC0000'>\n" + error.message + "\n" + error.stack + "</font>";
    var log = Logger.getFormattedLog();
    return paragraf + "\n\nLOG:\n" + log;
};
Threading.initThread = function(name, func, priority, isErrorFatal, formatFunc) {
    var thread = new java.lang.Thread(function() {
        try {
            android.os.Process.setThreadPriority(parseInt(priority) || 0);
            func();
        } catch (e) {
            var msg = "fatal error in thread " + name + ": " + e;
            Logger.Log(msg, "ERROR");
            Logger.LogError(e);
            Logger.flush();
            if (isErrorFatal) {
                var formattedMessage = Threading.formatFatalErrorMessage(e, name, priority, formatFunc);
                GameAPI.dialogMessage(formattedMessage, "FATAL ERROR");
            }
        }
        delete Threading.threads[name];
    });
    Threading.threads[name] = thread;
    thread.start();
    return thread;
};
Threading.getThread = function(name) {
    return this.threads[name];
};



var ModAPI = {};
ModAPI.modAPIs = {};
ModAPI.registerAPI = function(name, api, descr) {
    if (!descr) descr = {};
    if (!descr.name) descr.name = name;
    if (!descr.props) descr.props = {};
    this.modAPIs[name] = { api: api, descr: descr };
    Callback.invokeCallback("API:" + name, api, descr);
};
ModAPI.requireAPI = function(name) {
    if (this.modAPIs[name]) return this.modAPIs[name].api || null;
    return null;
};
ModAPI.requireGlobal = function(name) {
    try {
        return eval(name);
    } catch (e) {
        Logger.Log("ModAPI.requireGlobal for " + name + " failed: " + e, "ERROR");
        return null;
    }
};
ModAPI.requireAPIdoc = function(name) {
    if (this.modAPIs[name]) {
        return this.modAPIs[name].descr || null;
    }
    return null;
};
ModAPI.requireAPIPropertyDoc = function(name, prop) {
    var descr = this.requireAPIdoc(name);
    if (descr) return descr.props[prop] || null;
    return null;
};
ModAPI.getModByName = function(modName) {
    logDeprecation("ModAPI.getModByName");
    return null;
};
ModAPI.isModLoaded = function(modName) {
    logDeprecation("ModAPI.isModLoaded");
    return false;
};

ModAPI.addAPICallback = function(apiName, func) {
    if (this.modAPIs[apiName]) func(this.requireAPI(apiName));
    else Callback.addCallback("API:" + apiName, func);
};
ModAPI.addModCallback = function(modName, func) {
    logDeprecation("ModAPI.addModCallback");
    if (this.isModLoaded(modName)) func(this.getModByName(modName));
    else Callback.addCallback("ModLoaded:" + modName, func);
};
ModAPI.getModList = function() {
    logDeprecation("ModAPI.getModList");
    return [];
};
ModAPI.getModPEList = function() {
    logDeprecation("ModAPI.getModPEList");
    return [];
};
ModAPI.addTexturePack = function(path) {
    logDeprecation("ModAPI.addTexturePack");
};

ModAPI.cloneAPI = function(api, deep) {
    var cloned = {};
    for (var name in api) {
        var prop = api[name];
        if (deep && prop && (prop.push || prop + "" == "[object Object]"))
            cloned[name] = this.cloneAPI(prop, false);
		else cloned[name] = prop;
    }
    return cloned;
};
ModAPI.inheritPrototypes = function(source, target) {
    for (var name in source)
        if (!target[name])
            target[name] = source[name];
    return target;
};
ModAPI.cloneObject = function(source, deep, rec) {
    if (!rec) rec = 0;
    if (rec > 6) {
        Logger.Log("object clone failed: stackoverflow at " + source, "WARNING");
        return source;
    }
    if (source + "" == "undefined") return undefined;
    if (source == null) return null;
    var cloned = {};
    for (var name in source) {
        var prop = source[name];
        if (deep && typeof (prop) == "object")
            cloned[name] = this.cloneObject(prop, true, rec + 1);
        else cloned[name] = prop;
    }
    return cloned;
};
ModAPI.debugCloneObject = function(source, deep, rec) {
    if (!rec) rec = 0;
    if (rec > 5) return "stackoverflow";
    if (source + "" == "undefined") return undefined;
    if (source == null) return null;
    var cloned = {};
    for (var name in source) {
        var prop = source[name];
        if (deep && typeof (prop) == "object")
            cloned[name] = this.cloneObject(prop, true, rec + 1);
        else cloned[name] = prop;
    }
    return cloned;
};



var SaverAPI = {};
SaverAPI.addSavesScope = function(name, loadFunc, saveFunc) {
    return Saver.registerScopeSaver(name, { read: loadFunc, save: saveFunc });
};
SaverAPI.registerScopeSaver = function(name, saver) {
    return Saver.registerScopeSaver(name, saver);
};
SaverAPI.registerObjectSaver = function(name, saver) {
    return Saver.registerObjectSaver(name, saver);
};
SaverAPI.registerObject = function(obj, saverId) {
    Saver.registerObject(obj, saverId);
};
SaverAPI.setObjectIgnored = function(obj, ignore) {
    Saver.setObjectIgnored(obj, ignore);
};



var GameAPI = {};
GameAPI.spendItemsInCreative = false;
GameAPI.isDeveloperMode = false;
GameAPI.prevent = function() {
    preventDefault();
};
GameAPI.isActionPrevented = function() {
    return MCSystem.isDefaultPrevented(); 
};

GameAPI.message = function(msg) {
    clientMessage(msg + "");
};
GameAPI.tipMessage = function(msg) {
    tipMessage(msg + "");
};
GameAPI.dialogMessage = function(message, title) {
    GuiUtils.Run(function() {
        var ctx = getMcContext();
        var builder = android.app.AlertDialog.Builder(ctx);
        if (title) builder.setTitle(title + "");
        if (message) {
            message += "";
            message = message.split("\n").join("<br>");
            builder.setMessage(android.text.Html.fromHtml(message));
        }
        builder.show();
    });
};

GameAPI.setDifficulty = function(difficulty) {
    Level.setDifficulty(difficulty);
};
GameAPI.getDifficulty = function() {
    return Level.getDifficulty();
};
GameAPI.setGameMode = function(gameMode) {
    Level.setGameMode(gameMode);
};
GameAPI.getGameMode = function() {
    return Level.getGameMode();
};
GameAPI.getMinecraftVersion = function() {
    return MCSystem.getMinecraftVersion();
};
GameAPI.getEngineVersion = function() {
    return CORE_ENGINE_VERSION;
};
GameAPI.isItemSpendingAllowed = function() {
    return this.spendItemsInCreative || this.getGameMode() != 1;
};

Callback.addCallback("CoreConfigured", function(config) {
    GameAPI.isDeveloperMode = GameAPI.spendItemsInCreative = config.getBool("developer_mode");
});



function GameObject(name, Prototype) {
    this.originalName = this.gameobjectName = name;
    this.saverId = -1;
    if (this.gameobjectName) {
        this.gameobjectName = GameObjectRegistry.genUniqueName(this.gameobjectName);
        GameObjectRegistry.registerClass(this);
    }
    this.isInstance = false;
    this.isDeployed = false;
    this.Prototype = Prototype;
    this.instantiate = function() {
        var gameobject = {};
        for (var name in this)
            gameobject[name] = this[name];
        for (var name in this.Prototype)
            gameobject[name] = this.Prototype[name];
        gameobject.isInstance = true;
        if (this.saverId != -1)
            Saver.registerObject(this, this.saverId);
        return gameobject;
    };
    this.deploy = function() {
        var gameobject = this.instantiate();
        if (gameobject.init) gameobject.init.apply(gameobject, arguments);
        GameObjectRegistry.deployGameObject(gameobject);
        return gameobject;
    };
    this.destroy = function() {
        if (this.isInstance) {
            this.remove = true;
            GameObjectRegistry.removeGameObject(this);
        }
    };
}


var GameObjectRegistry = {};
GameObjectRegistry.gameObjectTypes = {};
GameObjectRegistry.genUniqueName = function(name) {
    name += "";
    while (this.gameObjectTypes[name])
        name = "_" + name;
    return name;
};
GameObjectRegistry.registerClass = function(gameObjectClass) {
    this.gameObjectTypes[gameObjectClass.gameobjectName] = gameObjectClass;
    gameObjectClass.saverId = Saver.registerObjectSaver(gameObjectClass.gameobjectName, {
		read: function(obj) {
			var gameobject = gameObjectClass.instantiate();
			for (var name in obj) gameobject[name] = data[name];
			gameobject.isDeployed = false;
			gameobject.isInstance = true;
			GameObjectRegistry.deployGameObject(gameobject);
		    return null;
		}, save: function(obj) { return obj; }
	});
};
GameObjectRegistry.deployGameObject = function(gameobject) {
    if (gameobject.isDeployed) {
        Logger.Log("trying to deploy game object (" + gameobject.originalName + ") while its already in update", "WARNING");
        return;
    }
    Updatable.addUpdatable(gameobject);
    this.addGameObject(gameobject);
    gameobject.loaded && gameobject.loaded();
    return gameobject;
};

GameObjectRegistry.activeGameObjects = {};
GameObjectRegistry.addGameObject = function(gameobject) {
    if (gameobject.originalName && !gameobject.isDeployed) {
        if (!this.activeGameObjects[gameobject.originalName])
            this.activeGameObjects[gameobject.originalName] = [];
        this.activeGameObjects[gameobject.originalName].push(gameobject);
    }
    gameobject.isDeployed = true;
};
GameObjectRegistry.removeGameObject = function(gameobject) {
    if (gameobject.originalName && gameobject.isDeployed) {
        var array = this.activeGameObjects[gameobject.originalName];
        for (var i in array) {
            if (array[i] == gameobject) {
                array.splice(i, 1);
                break;
            }
        }
    }
    gameobject.isDeployed = false;
};

GameObjectRegistry.resetEngine = function() {
    this.activeGameObjects = {};
};
GameObjectRegistry.getAllByType = function(type, clone) {
    if (clone) {
        var array = this.activeGameObjects[type];
        var cloned = [];
        for (var i in array)
            cloned.push(array[i]);
        return cloned;
    } else return this.activeGameObjects[type] || [];
};
GameObjectRegistry.callForType = function() {
    var params = [];
    for (var i in arguments) {
        params.push(arguments[i]);
    }
    var type = params.shift();
    var func = params.shift();
    var allGameObjects = this.getAllByType(type);
    for (var i = 0; i < allGameObjects.length; i++) {
        var gameobject = allGameObjects[i];
        if (gameobject[func]) gameobject[func].apply(gameobject, params);
    }
};
GameObjectRegistry.callForTypeSafe = function() {
    var params = [];
    for (var i in arguments)
        params.push(arguments[i]);
    var type = params.shift();
    var func = params.shift();
    var allGameObjects = this.getAllByType(type, true);
    for (var i = 0; i < allGameObjects.length; i++) {
        var gameobject = allGameObjects[i];
        if (gameobject[func]) gameobject[func].apply(gameobject, params);
    }
};



var TileEntityBasePrototype = {};
TileEntityBasePrototype.remove = false;
TileEntityBasePrototype.isLoaded = false;
TileEntityBasePrototype.__initialized = false;
TileEntityBasePrototype.defaultValues = {};

TileEntityBasePrototype.update = function() {
    if (!this.__initialized) {
        Saver.registerObject(this, this.saverId);
        if (!TileEntity.isTileEntityLoaded(this))
            return;
        this.init();
        this.__initialized = true;
    }
    if (this.isLoaded) this.tick();
};

TileEntityBasePrototype.created = function() {};
TileEntityBasePrototype.init = function() {};
TileEntityBasePrototype.tick = function() {};
TileEntityBasePrototype.click = function(id, count, data, coords) {
    return false;
};
TileEntityBasePrototype.destroyBlock = function(coords, player) {};
TileEntityBasePrototype.redstone = function(params) {};
TileEntityBasePrototype.projectileHit = function(coords, projectile) {};
TileEntityBasePrototype.destroy = function() {
    return false;
};
TileEntityBasePrototype.getGuiScreen = function() {
    return null;
};

TileEntityBasePrototype.onItemClick = function(id, count, data, coords) {
    if (this.click(id, count, data))
        return true;
    if (Entity.isSneaking(getPlayerEnt()))
        return false;
    var screen = this.getGuiScreen();
    if (screen) {
        this.container.openAs(screen);
        return true;
    }
};
TileEntityBasePrototype.selfDestroy = function() {
    TileEntity.destroyTileEntity(this);
};
TileEntityBasePrototype.requireMoreLiquid = function(liquid, amount) {};


var TILE_ENTITY_CHECKER_ITERATIONS = 10;

var TileEntity = {};
TileEntity.tileEntityList = [];
TileEntity.resetEngine = function() {
    this.tileEntityList = [];
};

TileEntity.tileEntityPrototypes = {};
TileEntity.registerPrototype = function(blockID, customPrototype) {
    var Prototype = {};
    for (var property in TileEntityBasePrototype)
        Prototype[property] = TileEntityBasePrototype[property];
    for (var property in customPrototype)
        Prototype[property] = customPrototype[property];
    Prototype.blockID = blockID;
    this.tileEntityPrototypes[blockID] = Prototype;
    var saverName = "_TILE_ENTITY" + blockID;
    Prototype.saverId = Saver.registerObjectSaver(saverName, {
		read: function(obj) {
            var instance = {};
            for (var property in Prototype)
                instance[property] = Prototype[property];
            instance.data = obj.data;
            instance.x = obj.coords.x;
            instance.y = obj.coords.y;
            instance.z = obj.coords.z;
            instance.dimension = obj.coords.d || 0;
            instance.container = obj.container;
            instance.liquidStorage = obj.liquidStorage;
            if (!instance.container)
                instance.container = new UI.Container();
            instance.container.setParent(instance);
            if (!instance.liquidStorage)
                instance.liquidStorage = new LiquidRegistry.Storage();
            instance.liquidStorage.setParent(instance);
            TileEntity.addUpdatableAsTileEntity(instance);
			return instance;
        }, save: function(obj) {
            return {
			    data: obj.data,
			    container: obj.container,
			    liquidStorage: obj.liquidStorage,
			    coords: { x: obj.x, y: obj.y, z: obj.z, d: obj.dimension }
			};
		}
	});
    if (customPrototype.redstone)
        Block.setRedstoneTile(blockID, -1, true);
};
TileEntity.getPrototype = function(blockID) {
    return this.tileEntityPrototypes[blockID];
};
TileEntity.isTileEntityBlock = function(blockID) {
    return !!this.tileEntityPrototypes[blockID];
};
TileEntity.createTileEntityForPrototype = function(Prototype, addToUpdate) {
    var tileEntity = {};
    for (var property in Prototype)
        tileEntity[property] = Prototype[property];
    tileEntity.data = {};
    for (var property in Prototype.defaultValues)
        tileEntity.data[property] = Prototype.defaultValues[property];
    tileEntity.container = new UI.Container(tileEntity);
    tileEntity.liquidStorage = new LiquidRegistry.Storage(tileEntity);
    if (addToUpdate) {
        Updatable.addUpdatable(tileEntity);
        tileEntity.remove = false;
        tileEntity.isLoaded = true;
    }
    return tileEntity;
};

TileEntity.addTileEntity = function(x, y, z) {
    if (this.getTileEntity(x, y, z)) return null;
    var tile = getTile(x, y, z);
    var Prototype = this.getPrototype(tile);
    if (Prototype) {
        var tileEntity = this.createTileEntityForPrototype(Prototype, true);
        tileEntity.x = x;
        tileEntity.y = y;
        tileEntity.z = z;
        tileEntity.dimension = Player.getDimension();
        this.tileEntityList.push(tileEntity);
        tileEntity.created();
        Callback.invokeCallback("TileEntityAdded", tileEntity, true);
        return tileEntity;
    }
    return null;
};
TileEntity.addUpdatableAsTileEntity = function(updatable) {
    updatable.remove = false;
    updatable.isLoaded = true;
    this.tileEntityList.push(updatable);
    Callback.invokeCallback("TileEntityAdded", updatable, false);
};
TileEntity.getTileEntity = function(x, y, z) {
    for (var i in this.tileEntityList) {
        var tileEntity = this.tileEntityList[i];
        if (tileEntity.x == x && tileEntity.y == y && tileEntity.z == z)
            return tileEntity;
    }
    return null;
};
TileEntity.destroyTileEntity = function(tileEntity) {
    if (tileEntity.destroy()) return false;
    tileEntity.remove = true;
    tileEntity.container.dropAt(tileEntity.x + 0.5, tileEntity.y + 0.5, tileEntity.z + 0.5);
    for (var i in this.tileEntityList)
        if (this.tileEntityList[i] == tileEntity)
            this.tileEntityList.splice(i--, 1);
    Callback.invokeCallback("TileEntityRemoved", tileEntity);
    return true;
};
TileEntity.destroyTileEntityAtCoords = function(x, y, z) {
    var tileEntity = this.getTileEntity(x, y, z);
    if (tileEntity) return this.destroyTileEntity(tileEntity);
    return false;
};

TileEntity.isTileEntityLoaded = function(tileEntity) {
    return tileEntity.dimension == Player.getDimension() && Level.isChunkLoadedAt(tileEntity.x, 0, tileEntity.z);
};
TileEntity.checkTileEntityForIndex = function(index) {
    var tileEntity = this.tileEntityList[index];
    tileEntity.isLoaded = this.isTileEntityLoaded(tileEntity);
    if (tileEntity.isLoaded) {
        var isPlaced = getTile(tileEntity.x, tileEntity.y, tileEntity.z) == tileEntity.blockID;
        if (!isPlaced) this.DeployDestroyChecker(tileEntity);
    }
};
TileEntity.CheckTileEntities = function() {
    var time = Updatable.getSyncTime();
    if (this.tileEntityList.length > 0)
        this.checkTileEntityForIndex(time % this.tileEntityList.length);
    return;
};
TileEntity.DeployDestroyChecker = function(tileEntity) {
    if (tileEntity.__checkInProgress) return;
    tileEntity.__checkInProgress = true;
    var checker = {
		tileEntity: tileEntity,
		age: 0,
		update: function() {
            var isPlaced = getTile(this.tileEntity.x, this.tileEntity.y, this.tileEntity.z) == tileEntity.blockID;
            if (isPlaced) {
                this.tileEntity.__checkInProgress = false;
                this.remove = true;
                return;
            }
            if (this.age++ > TILE_ENTITY_CHECKER_ITERATIONS) {
                TileEntity.destroyTileEntity(this.tileEntity);
                this.tileEntity.__checkInProgress = false;
                this.remove = true;
            }
        }
	};
    Updatable.addUpdatable(checker);
};

Callback.addCallback("tick", function() {
    TileEntity.CheckTileEntities();
});
Callback.addCallback("RedstoneSignal", function(coords, params, fullTile) {
    var tileEntity = TileEntity.getTileEntity(coords.x, coords.y, coords.z);
    if (tileEntity) tileEntity.redstone(params);
});
Callback.addCallback("DestroyBlock", function(coords, fullTile, player) {
    var tileEntity = TileEntity.getTileEntity(coords.x, coords.y, coords.z);
    if (tileEntity) {
        tileEntity.destroyBlock(coords, player);
        TileEntity.destroyTileEntity(tileEntity);
    }
});
Callback.addCallback("ProjectileHit", function(projectile, item, target) {
    var coords = target.coords;
    if (coords) {
        var tileEntity = TileEntity.getTileEntity(coords.x, coords.y, coords.z);
        if (tileEntity) tileEntity.projectileHit(coords, projectile, item, target);
    }
});



// TODO: probably some dead code, remove it later
var WorldGeneration = {};
WorldGeneration.checkTile = function(x, z) {
    var checkData = Level.getData(x, 0, z);
	print("Checking tile!");
    if (checkData != 8) {
        var checkTile = Level.getTile(x, 0, z);
        return checkTile != 0;
    }
};
WorldGeneration.execGeneration = function(chunk, dimension, underground) {
    (function() {
        if (dimension == 1) Callback.invokeCallback("GenerateNetherChunk", chunk.x, chunk.z);
        else if (dimension == 2) Callback.invokeCallback("GenerateEndChunk", chunk.x, chunk.z);
		else if (underground) Callback.invokeCallback("GenerateChunkUnderground", chunk.x, chunk.z);
		else Callback.invokeCallback("GenerateChunk", chunk.x, chunk.z);
        if (underground) Level.setTile(chunk.x * 16 + 1, 0, chunk.z * 16 + 1, 7, 8);
        else Level.setTile(chunk.x * 16, 0, chunk.z * 16, 7, 8);
    })();
	print("Hello, generation is executed!");
};

WorldGeneration.generatorUpdatable = null;
WorldGeneration.processChunk = function(chunk, origin, dimension) {
    var radius = Math.max(Math.abs(chunk.x - origin.x), Math.abs(chunk.z - origin.z));
    if (radius <= this.generatorUpdatable.surface_radius)
        if (WorldGeneration.checkTile(chunk.x * 16, chunk.z * 16))
            WorldGeneration.execGeneration(chunk, dimension, false);
    if (radius <= this.generatorUpdatable.underground_radius && dimension == 0 && getPlayerY() < 64)
        if (WorldGeneration.checkTile(chunk.x * 16 + 1, chunk.z * 16 + 1))
            WorldGeneration.execGeneration(chunk, dimension, true);
	print("Hello, generation is processed!");
};

WorldGeneration.resetEngine = function() {
    if (this.generatorUpdatable)
        this.generatorUpdatable.remove = true;
    this.generatorUpdatable = {
		age: 0,
		delay: 3,
		surface_radius: 3,
		underground_radius: 1,
		thread_optimization: false,
		generation_priority: 0,
		ticking_priority: 0,
		debug: false,
		debug_max_time: 0,
		update: function() {
			if (this.age++ % this.delay > 0) return;
			var radius = Math.max(this.surface_radius, this.underground_radius);
			var width = radius * 2 + 1;
			var step = (this.age / this.delay) % (width * width);
			var chunk = { x: parseInt(step % width) - radius, z: parseInt(step / width) - radius };
			var origin = { x: Math.floor(getPlayerX() / 16 + 0.5), z: Math.floor(getPlayerZ() / 16 + 0.5) };
			(chunk.x += origin.x, chunk.z += origin.z);
			var dimension = Player.getDimension();
			if (this.debug) {
				var timeStart = CoreAPI.Debug.sysTime();
				WorldGeneration.processChunk(chunk, origin, dimension);
				var timeEnd = CoreAPI.Debug.sysTime();
				var time = (timeEnd - timeStart) / 1000;
				if (time > this.debug_max_time) {
					this.debug_max_time = time;
					Logger.Log("Chunk Generation Took " + time + "s", "DEBUG");
				}
			} else WorldGeneration.processChunk(chunk, origin, dimension);
			print("Hello, generation is updated!");
		}
	};
};


var WorldGenerationUtils = {};
WorldGenerationUtils.isTerrainBlock = function(id) {
    return GenerationUtils.isTerrainBlock(id);
};
WorldGenerationUtils.isTransparentBlock = function(id) {
    return GenerationUtils.isTransparentBlock(id);
};
WorldGenerationUtils.getPerlinNoise = requireMethodFromNativeAPI("api.NativeGenerationUtils", "getPerlinNoise");
WorldGenerationUtils.randomXZ = function(cx, cz) {
    return {
		x: parseInt((Math.random() + cx) * 16),
		z: parseInt((Math.random() + cz) * 16)
	};
};
WorldGenerationUtils.randomCoords = function(cx, cz, lowest, highest) {
    if (!lowest) lowest = 0;
    if (!highest) highest = 128;
    if (highest < lowest) highest = lowest;
    var coords = this.randomXZ(cx, cz);
    coords.y = parseInt(Math.random() * (highest - lowest) + lowest);
    return coords;
};

WorldGenerationUtils.canSeeSky = function(x, y, z) {
    return GenerationUtils.canSeeSky(x, y, z);
};
WorldGenerationUtils.findSurface = function(x, y, z) {
    return {
		x: x, y: GenerationUtils.findSurface(x, y, z), z: z
	};
};
WorldGenerationUtils.findHighSurface = function(x, z) {
    return this.findSurface(x, 128, z);
};
WorldGenerationUtils.findLowSurface = function(x, z) {
    return this.findSurface(x, 64, z);
};

WorldGenerationUtils.__lockedReal = { id: 0, data: 0 };
WorldGenerationUtils.lockInBlock = function(id, data, checkerTile, checkerMode) {
    this.__lockedReal = { id: id, data: data };
    var id = this.__lockedReal.id;
    var data = this.__lockedReal.data;
    if (checkerTile + "" == "undefined")
        this.setLockedBlock = function(x, y, z) {
            setTile(x, y, z, id, data);
        };
    else if (checkerMode)
	    this.setLockedBlock = function(x, y, z) {
			if (getTile(x, y, z) != checkerTile)
				setTile(x, y, z, id, data);
		};
	else
		this.setLockedBlock = function(x, y, z) {
			if (getTile(x, y, z) == checkerTile)
				setTile(x, y, z, id, data);
		};
};
WorldGenerationUtils.setLockedBlock = function(x, y, z) {
    setTile(x, y, z, this.__lockedReal.id, this.__lockedReal.data);
};

WorldGenerationUtils.genMinable = function(x, y, z, params) {
    if (!params.ratio) params.ratio = 1;
    if (!params.amount) params.amount = params.size * params.ratio * 3;
    if (!params.amount) {
        Logger.Log("failed to call old method GenerationUtils.genMinable, amount parameter is 0", "ERROR");
        return;
    }
    GenerationUtils.generateOre(x, y, z, params.id, params.data, Math.max(1, params.amount), params.noStoneCheck);
};
WorldGenerationUtils.generateOre = function(x, y, z, id, data, amount, noStoneCheck) {
    GenerationUtils.generateOre(x, y, z, id, data, amount, noStoneCheck);
};
WorldGenerationUtils.generateOreCustom = function(x, y, z, id, data, amount, whitelist, blocks) {
    GenerationUtils.generateOreCustom(x, y, z, id, data, amount, whitelist, blocks);
};



var BLOCK_BASE_PROTOTYPE = {
	__validBlockTypes: {
		createBlock: true,
		createBlockWithRotation: true
	}
};

BLOCK_BASE_PROTOTYPE.__define = function(item) {
    var variations = this.getVariations(item);
    if (!variations) {
        Logger.Log("block prototype " + this.stringID + " has no variations, it will be replaced with missing block (1 variation)", "WARNING");
        variations = { name: "noname:" + this.stringID, texture: [["__missing", 0]] };
    }
    var specialType = this.getSpecialType(item);
    if (!this.__validBlockTypes[this.type]) {
        Logger.Log("block prototype " + this.stringID + " has invalid type " + this.type + " it will be replaced with default", "WARNING");
        this.type = "createBlock";
    }
    BlockRegistry[this.type](this.stringID, variations, specialType);
    if (!this.isDefined) {
        var __self = this;
        if (this.getDrop) {
            BlockRegistry.registerDropFunction(this.stringID, function(blockCoords, blockID, blockData, diggingLevel, enchant) {
                return __self.getDrop(blockCoords, blockID, blockData, diggingLevel, enchant);
            });
        }
        if (this.onPlaced) {
            BlockRegistry.registerDropFunction(this.stringID, function(coords, item, block) {
                return __self.onPlaced(coords, item, block);
            });
        }
    }
    this.isDefined = true;
};
BLOCK_BASE_PROTOTYPE.__describe = function(item) {
    if (!this.isDefined) {
        Logger.Log("block prototype cannot call __describe method: block is not defined", "ERROR");
        return;
    }
    var material = this.getMaterial(item);
    var diggingLevel = this.getDestroyLevel(item);
    if (diggingLevel > 0 && material) {
        if (material != null) BlockRegistry.setBlockMaterial(this.id, material, diggingLevel);
        if (this.getDrop) ToolAPI.registerBlockDiggingLevel(this.id, diggingLevel);
        else BlockRegistry.setDestroyLevelForID(this.id, level);
    }
    var shape = this.getShape() || [0, 0, 0, 1, 1, 1];
    if (shape.length >= 6) BlockRegistry.setBlockShape(this.id, { x: shape[0], y: shape[1], z: shape[2] },
		                                                        { x: shape[3], y: shape[4], z: shape[5] });
    else Logger.Log("block prototype " + this.stringID + " has invalid block shape " + shape, "WARNING");
};

BLOCK_BASE_PROTOTYPE.init = function() {};
BLOCK_BASE_PROTOTYPE.getVariations = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getSpecialType = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getCategory = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getEnchant = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getProperties = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.isStackedByData = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.isEnchanted = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getMaterial = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getDestroyLevel = function(item) {
    return 0;
};
BLOCK_BASE_PROTOTYPE.getShape = function(item) {
    return null;
};
BLOCK_BASE_PROTOTYPE.getDrop = null;
BLOCK_BASE_PROTOTYPE.onPlaced = null;
BLOCK_BASE_PROTOTYPE.onItemUsed = null;


var BlockRegistry = {
	TYPE_BASE: "createBlock",
	TYPE_ROTATION: "createBlockWithRotation"
};

BlockRegistry.idSource = BlockID;
BlockRegistry.getNumericId = function(id) {
    if (typeof (id) == "string") {
        var _id = this.idSource[id];
        if (!_id) {
            Logger.Log("Invalid item namedID: " + id + ", -1 will be returned", "ERROR");
            return -1;
        }
        id = _id;
    }
    return parseInt(id);
};

BlockRegistry.createBlock = function(namedID, defineData, blockType) {
    var numericID = this.idSource[namedID];
    if (!numericID) {
        Logger.Log("Invalid block namedID: " + namedID, "ERROR");
        return false;
    }
    Block.createBlock(numericID, namedID, defineData, blockType);
    return true;
};
BlockRegistry.createBlockWithRotation = function(namedID, defineData, blockType) {
    var numericID = this.idSource[namedID];
    if (!numericID) {
        Logger.Log("Invalid block namedID: " + namedID, "ERROR");
        return false;
    }
    var rotatedBlocks = [];
    for (var i in defineData) {
        var block = defineData[i];
        var td = block.texture;
        var rotated = [[td[0], td[1], td[2], td[3], td[4], td[5]], [td[0], td[1], td[3], td[2], td[5], td[4]], [td[0], td[1], td[5], td[4], td[2], td[3]], [td[0], td[1], td[4], td[5], td[3], td[2]]];
        for (var j in rotated)
            rotatedBlocks.push({
				name: block.name,
				texture: rotated[j],
				inCreative: block.inCreative && j == 0
			});
    }
    this.createBlock(namedID, rotatedBlocks, blockType);
    this.registerPlaceFunction(namedID, function(coords, item, block) {
        var yaw = Math.floor((Entity.getYaw(getPlayerEnt()) - 45) / 90);
        while (yaw < 0) yaw += 4;
        while (yaw > 3) yaw -= 4;
        var meta = { 0: 2, 1: 0, 2: 3, 3: 1 }[yaw];
        if (canTileBeReplaced(getTile(coords.relative.x, coords.relative.y, coords.relative.z)))
            setTile(coords.relative.x, coords.relative.y, coords.relative.z, item.id, parseInt(item.data / 4) * 4 + meta);
        return coords.relative;
    });
    this.registerDropFunction(namedID, function(coords, blockID, blockData) {
        return [[numericID, 1, parseInt(blockData / 4) * 4]];
    });
};
BlockRegistry.createSpecialType = function(description, nameKey) {
    if (!nameKey) {
        nameKey = "_CE";
        var names = [];
        for (var name in description)
            names.push(name);
        names.sort();
        for (var i in names)
            nameKey += "$" + names[i] + "$" + description[names[i]];
    }
    return Block.createSpecialType(nameKey, description);
};
BlockRegistry.setPrototype = function(namedID, Prototype) {
    var numericID = IDRegistry.genBlockID(namedID);
    for (var name in BLOCK_BASE_PROTOTYPE)
        if (!Prototype[name])
            Prototype[name] = BLOCK_BASE_PROTOTYPE[name];
    Prototype.id = numericID;
    Prototype.stringID = namedID;
    Prototype.__define(null);
    Prototype.__describe(null);
    Prototype.init();
};

BlockRegistry.isNativeTile = function(id) {
    return !IDRegistry.getNameByID(id);
};
BlockRegistry.convertBlockToItemId = function(id) {
	return id > 255 && this.isNativeTile(id) ? 255 - id : id;
};
BlockRegistry.convertItemToBlockId = function(id) {
    return id < 0 ? 255 - id : id;
};
BlockRegistry.setDestroyLevelForID = function(id, level, resetData) {
    this.registerDropFunctionForID(id, function(blockCoords, blockID, blockData, diggingLevel) {
        if (BlockRegistry.isNativeTile(blockID) && level <= 0) return null;
        if (diggingLevel >= level) return [[BlockRegistry.convertBlockToItemId(blockID), 1, resetData ? 0 : blockData]];
    }, level);
};
BlockRegistry.setDestroyLevel = function(namedID, level) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    return this.setDestroyLevelForID(numericID, level);
};
BlockRegistry.setDestroyTime = function(namedID, time) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    return Block.setDestroyTime(numericID, time);
};
BlockRegistry.isSolid = function(numericID) {
    return Block.isSolid(numericID);
};
BlockRegistry.getDestroyTime = function(numericID) {
    return Block.getDestroyTime(numericID);
};
BlockRegistry.getExplosionResistance = function(numericID) {
    return Block.getExplosionResistance(numericID);
};
BlockRegistry.getFriction = function(numericID) {
    return Block.getFriction(numericID);
};
BlockRegistry.getTranslucency = function(numericID) {
    return Block.getTranslucency(numericID);
};
BlockRegistry.getLightLevel = function(numericID) {
    return Block.getLightLevel(numericID);
};
BlockRegistry.getLightOpacity = function(numericID) {
    return Block.getLightOpacity(numericID);
};
BlockRegistry.getRenderLayer = function(numericID) {
    return Block.getRenderLayer(numericID);
};
BlockRegistry.getRenderType = function(numericID) {
    return Block.getRenderType(numericID);
};
BlockRegistry.getBlockAtlasTextureCoords = function(name, id) {
    return Block.getBlockAtlasTextureCoords(name, id);
};
BlockRegistry.setTempDestroyTime = function(numericID, time) {
    Block.setTempDestroyTime(numericID, time);
};
BlockRegistry.setBlockMaterial = function(namedID, material, level) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    ToolAPI.registerBlockMaterial(numericID, material, level);
    return true;
};
BlockRegistry.setRedstoneTile = function(namedID, data, isRedstone) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    return Block.setRedstoneTile(numericID, data, isRedstone);
};
BlockRegistry.setBlockShape = function(id, pos1, pos2, data) {
    Block.setShape(id, pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z, data);
};
BlockRegistry.setShape = function(id, x1, y1, z1, x2, y2, z2, data) {
    Block.setShape(id, x1, y1, z1, x2, y2, z2, data);
};

BlockRegistry.dropFunctions = {};
BlockRegistry.registerDropFunctionForID = function(numericID, dropFunc, level) {
    this.dropFunctions[numericID] = dropFunc;
    if (level) ToolAPI.registerBlockDiggingLevel(numericID, level);
    return true;
};
BlockRegistry.registerDropFunction = function(namedID, dropFunc, level) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    return this.registerDropFunctionForID(numericID, dropFunc, level);
};
BlockRegistry.defaultDropFunction = function(blockCoords, blockID, blockData, diggingLevel) {
    if (BlockRegistry.isNativeTile(blockID)) return null;
    return [[BlockRegistry.convertBlockToItemId(blockID), 1, blockData]];
};
BlockRegistry.getDropFunction =function(id) {
    return this.dropFunctions[id] || this.defaultDropFunction;
};
BlockRegistry.getBlockDropViaItem = function(block, item, coords) {
    var enchantData = ToolAPI.getEnchantExtraData(item.extra);
    var toolData = ToolAPI.getToolData(item.id);
    this.__func = this.getDropFunction(block.id);
    if (toolData && toolData.modifyEnchant)
        toolData.modifyEnchant(enchantData, item, coords, block);
    return this.__func(coords, block.id, block.data, ToolAPI.getToolLevelViaBlock(item.id, block.id), enchantData);
};
BlockRegistry.onBlockDestroyed = function(coords, fullTile, byHand) {
    var carried = PlayerAPI.getCarriedItem();
    var result = this.getBlockDropViaItem(fullTile, carried, coords);
    if (result != null) {
        Level.destroyBlock(coords.x, coords.y, coords.z);
        if (GameAPI.isItemSpendingAllowed() || !byHand) for (var i in result)
			Level.dropItem(coords.x + 0.5, coords.y + 0.5, coords.z + 0.5, 0, result[i][0], result[i][1], result[i][2]);
        var toolData = ToolAPI.getToolData(carried.id);
        if (toolData) {
            if (toolData.isNative && GameAPI.isItemSpendingAllowed()) {
                carried.data++;
                if (carried.data >= toolData.toolMaterial.durability)
                    carried.id = carried.count = carried.data = 0;
                PlayerAPI.setCarriedItem(carried.id, carried.count, carried.data, carried.extra);
            }
            if (toolData.onMineBlock) toolData.onMineBlock(coords, carried, fullTile);
        }
    }
};

BlockRegistry.popResourceFunctions = {};
BlockRegistry.registerPopResourcesFunctionForID = function(numericID, func) {
    this.popResourceFunctions[numericID] = func;
    return true;
};
BlockRegistry.registerPopResourcesFunction = function(nameID, func) {
    var numericID = this.getNumericId(nameID);
    if (numericID == -1) return false;
    return this.registerPopResourcesFunctionForID(numericID, func);
};
BlockRegistry.onBlockPoppedResources = function(coords, block, f, i) {
    var func = this.popResourceFunctions[block.id];
    if (func) func(coords, block, f, i);
};

BlockRegistry.placeFuncs = [];
BlockRegistry.registerPlaceFunctionForID = function(block, func) {
    this.placeFuncs[block] = func;
};
BlockRegistry.registerPlaceFunction = function(namedID, func) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    this.registerPlaceFunctionForID(numericID, func);
};
BlockRegistry.getPlaceFunc = function(block) {
    return this.placeFuncs[block];
};

Callback.addCallback("DestroyBlock", function(coords, fullTile) {
    BlockRegistry.onBlockDestroyed(coords, fullTile, true);
});
Callback.addCallback("PopBlockResources", function(coords, block, i, f) {
    BlockRegistry.onBlockPoppedResources(coords, block, i, f);
});



var ITEM_BASE_PROTOTYPE = {
	__validItemTypes: {
		createItem: true,
		createFoodItem: true,
		createArmorItem: true,
		createThrowableItem: true
	}
};

ITEM_BASE_PROTOTYPE.__define = function(item) {
    var name = this.getName(item);
    if (!name) {
        Logger.Log("item prototype " + this.stringID + " has no name", "WARNING");
        name = "noname:" + this.stringID;
    }
    var texture = this.getTexture(item);
    if (!texture) {
        Logger.Log("item prototype " + this.stringID + " has no texture, it will be replaced with missing icon", "WARNING");
        texture = {name: "__missing"};
    }
    var params = this.getDefineParams(item);
    if (!this.__validItemTypes[this.type]) {
        Logger.Log("item prototype " + this.stringID + " has invalid type " + this.type + " it will be replaced with default", "WARNING");
        this.type = "createItem";
    }
    ItemRegistry[this.type](this.stringID, name, texture, params);
    if (!this.isDefined) {
        var __self = this;
        ItemRegistry.registerUseFunction(this.stringID, function(coords, item, block) {
            __self.onUsed(coords, item, block);
        });
        ItemRegistry.registerThrowableFunction(this.stringID, function(projectile, item, target) {
            __self.onThrowableImpact(projectile, item, target);
        });
    }
    this.isDefined = true;
};
ITEM_BASE_PROTOTYPE.__describe = function(item) {
    if (!this.isDefined) {
        Logger.Log("item prototype cannot call __describe method: item is not defined", "ERROR");
        return;
    }
    var maxDamage = this.getMaxDamage(item);
    if (maxDamage != null) ItemRegistry.setMaxDamage(this.id, maxDamage);
    var category = this.getCategory(item);
    if (category != null) ItemRegistry.setCategory(this.id, category);
    var enchant = this.getEnchant(item);
    if (enchant != null) ItemRegistry.setEnchantType(this.id, enchant.type, enchant.value);
    var useAnimation = this.getUseAnimation(item);
    if (useAnimation != null) ItemRegistry.setUseAnimation(this.id, useAnimation);
    var maxUseDuration = this.getMaxUseDuration(item);
    if (maxUseDuration != null) ItemRegistry.setMaxUseDuration(this.id, maxUseDuration);
    var properties = this.getProperties(item);
    if (properties) {
        properties.foil = this.isEnchanted(item);
        ItemRegistry.setProperties(this.id, properties);
    }
    var toolRender = this.isToolRender(item);
    if (toolRender != null) ItemRegistry.setToolRender(this.id, toolRender);
    var stackByData = this.isStackedByData(item);
    if (stackByData != null) ItemRegistry.setStackedByData(this.id, stackByData);
    var armorFunc = this.getArmorFuncs(item);
    if (armorFunc != null) ArmorRegistry.registerFuncsForID(this.id, armorFunc);
    var toolMaterial = this.getToolMaterial(item);
    var toolPrototype = this.getToolPrototype(item);
    var toolTarget = this.getToolTarget(item);
    if (toolMaterial != null && toolPrototype != null && toolTarget != null) {
        ToolAPI.registerTool(this.id, toolMaterial, toolTarget, toolPrototype);
    }
};

ITEM_BASE_PROTOTYPE.init = function() {};
ITEM_BASE_PROTOTYPE.getName = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getTexture = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getDefineParams = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getMaxDamage = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getCategory = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getEnchant = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getUseAnimation = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getMaxUseDuration = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getProperties = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.isToolRender = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.isStackedByData = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.isEnchanted = function(item) {
    return null;
};
ITEM_BASE_PROTOTYPE.getToolMaterial = function() {
    return null;
};
ITEM_BASE_PROTOTYPE.getToolTarget = function() {
    return null;
};
ITEM_BASE_PROTOTYPE.getToolPrototype = function() {
    return null;
};
ITEM_BASE_PROTOTYPE.getArmorFuncs = function() {
    return null;
};

ITEM_BASE_PROTOTYPE.onUsed = function(coords, item, block) {};
ITEM_BASE_PROTOTYPE.onTick = function(item) {};
ITEM_BASE_PROTOTYPE.onThrowableImpact = function(projectile, item, target) {};


var ItemRegistry = {
	TYPE_BASE: "createItem",
	TYPE_FOOD: "createFoodItem",
	TYPE_ARMOR: "createArmorItem",
	TYPE_THROWABLE: "createThrowableItem"
};

ItemRegistry.idSource = ItemID;
ItemRegistry.getNumericId = function(id) {
    if (typeof (id) == "string") {
        var _id = this.idSource[id];
        if (!_id) {
            Logger.Log("Invalid item namedID: " + id + ", -1 will be returned", "ERROR");
            return -1;
        }
        id = _id;
    }
    return parseInt(id);
};
ItemRegistry.getItemById = function(id) {
    return Item.getItemById(this.getNumericId(id));
};

ItemRegistry.createItem = function(namedID, name, texture, params) {
    if (!params) params = {};
    params.stack = params.stack || 64;
    var numericID = this.idSource[namedID];
    if (!numericID) {
        Logger.Log("Invalid item namedID: " + namedID, "ERROR");
        return false;
    }
    var item = Item.createItem(numericID,  namedID, name, texture.name, texture.meta || texture.data || 0);
    item.setMaxStackSize(params.stack);
    if (!params.isTech) Player.addItemCreativeInv(numericID, 1, 0);
    return item;
};
ItemRegistry.createFoodItem = function(namedID, name, texture, params) {
    if (!params) params = {};
    params.stack = params.stack || 64;
    params.food = params.food || 1;
    var numericID = this.idSource[namedID];
    if (!numericID) {
        Logger.Log("Invalid item namedID: " + namedID, "ERROR");
        return null;
    }
    var item = Item.createFoodItem(numericID, namedID, name, texture.name, texture.meta || texture.data || 0, params.food);
    item.setMaxStackSize(params.stack || 64);
    if (!params.isTech) Player.addItemCreativeInv(numericID, 1, 0);
    return item;
};
ItemRegistry.createFuelItem = function(namedID, name, texture, params) {
    MCSystem.throwException("creation of fuel items is not yet supported");
};
ItemRegistry.createArmorItem = function(namedID, name, texture, params) {
    var validArmorTypes = {
		helmet: { id: 0 },
		chestplate: { id: 1 },
		leggings: { id: 2 },
		boots: { id: 3 }
	};
    if (!params) params = {};
    params.durability = params.durability || 1;
    params.armor = params.armor || 0;
    params.texture = params.texture || "textures/logo.png";
    var armorType;
    if (validArmorTypes[params.type])
        armorType = validArmorTypes[params.type].id;
    0else {
        Logger.Log("Invalid armor type for item " + namedID + ": " + params.type + ",use: \"helmet\", \"chestplate\", \"leggings\", \"boots\"", "ERROR");
        return;
    }
    var numericID = this.idSource[namedID];
    if (!numericID) {
        Logger.Log("Invalid item namedID: " + namedID, "ERROR");
        return false;
    }
    var item = Item.createArmorItem(numericID, namedID, name, texture.name, texture.meta || texture.data || 0, params.texture, armorType, params.armor, params.durability);
    item.setMaxStackSize(params.stack || 1);
    if (!params.isTech) Player.addItemCreativeInv(numericID, 1, 0);
    return item;
};
ItemRegistry.createThrowableItem = function(namedID, name, texture, params) {
    if (!params) params = {};
    params.stack = params.stack || 64;
    var numericID = this.idSource[namedID];
    if (!numericID) {
        Logger.Log("Invalid item namedID: " + namedID, "ERROR");
        return false;
    }
    var item = Item.createThrowableItem(numericID, namedID, name, texture.name, texture.meta || texture.data || 0);
    item.setMaxStackSize(params.stack || 64);
    if (!params.isTech) Player.addItemCreativeInv(numericID, 1, 0);
    return item;
};
ItemRegistry.setPrototype = function(namedID, Prototype) {
    var numericID = IDRegistry.genItemID(namedID);
    for (var name in ITEM_BASE_PROTOTYPE)
	    if (!Prototype[name])
			Prototype[name] = ITEM_BASE_PROTOTYPE[name];
    Prototype.id = numericID;
    Prototype.stringID = namedID;
    Prototype.__define(null);
    Prototype.__describe(null);
    Prototype.init();
};

ItemRegistry.isNativeItem = function(id) {
    return IDRegistry.isVanilla(id);
};
ItemRegistry.getMaxDamage = function(id) {
    return Item.getMaxDamage(id);
};
ItemRegistry.getMaxStack = function(id) {
    return Item.getMaxStackSize(id);
};
ItemRegistry.getName = function(id, data, encode) {
    return Item.getName(id, data);
};
ItemRegistry.isValid = function(id, data) {
    return Item.isValid(id);
};
ItemRegistry.addToCreative = function(id, count, data, extra) {
    id = this.getNumericId(id);
    if (id == -1) return;
    Player.addItemCreativeInv(id, count, data, extra);
};
ItemRegistry.addCreativeGroup = function(name, displayedName, ids) {
    for (var i in ids) Item.addToCreativeGroup(name, displayedName, ids[i]);
};
ItemRegistry.describeItem = function(numericID, description) {
    this.setCategory(numericID, description.category || 0);
    this.setToolRender(numericID, description.toolRender);
    this.setMaxDamage(numericID, description.maxDamage || 0);
    this.setStackedByData(numericID, description.stackByData);
    this.setUseAnimation(numericID, description.useAnimation);
    if (description.properties) this.setProperties(numericID, description.properties);
    if (description.maxUseDuration) this.setMaxUseDuration(numericID, description.maxUseDuration);
    if (description.enchant) this.setEnchantType(numericID, description.enchant.type, description.enchant.value);
};
ItemRegistry.setCategory = function(id, category) {
    Item.setCategoryForId(id, category);
};
ItemRegistry.setEnchantType = function(id, enchant, value) {
    this.getItemById(id).setEnchantType(enchant || 0, value || 0);
};
ItemRegistry.setArmorDamageable = function(id, val) {
    this.getItemById(id).setArmorDamageable(val);
};
ItemRegistry.addRepairItemIds = function(id, items) {
    var item = this.getItemById(id);
    for (var i in items) item.addRepairItem(items[i]);
};
ItemRegistry.setToolRender = function(id, enabled) {
    this.getItemById(id).setHandEquipped(enabled);
};
ItemRegistry.setMaxDamage = function(id, maxdamage) {
    this.getItemById(id).setMaxDamage(maxdamage);
};
ItemRegistry.setGlint = function(id, enabled) {
    this.getItemById(id).setGlint(enabled);
};
ItemRegistry.setLiquidClip = function(id, enabled) {
    this.getItemById(id).setLiquidClip(enabled);
};
ItemRegistry.setStackedByData = function(id, enabled) {
	// logDeprecation("ItemRegistry.setStackedByData");
};
ItemRegistry.setProperties = function(id, props) {
    this.getItemById(id).setProperties(props);
};
ItemRegistry.setUseAnimation = function(id, animType) {
    this.getItemById(id).setUseAnimation(animType || 0);
};
ItemRegistry.setMaxUseDuration = function(id, duration) {
    this.getItemById(id).setMaxUseDuration(duration);
};

ItemRegistry.useFunctions = {};
ItemRegistry.registerUseFunctionForID = function(numericID, useFunc) {
    this.useFunctions[numericID] = useFunc;
    return true;
};
ItemRegistry.registerUseFunction = function(namedID, useFunc) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    return this.registerUseFunctionForID(numericID, useFunc);
};
ItemRegistry.onItemUsed = function(coords, item, block) {
    this.__func = this.useFunctions[item.id];
    if (this.__func) var result = this.__func(coords, item, block);
};

ItemRegistry.throwableFunctions = {};
ItemRegistry.registerThrowableFunctionForID = function(numericID, useFunc) {
    this.throwableFunctions[numericID] = useFunc;
    return true;
};
ItemRegistry.registerThrowableFunction = function(namedID, useFunc) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    return this.registerThrowableFunctionForID(numericID, useFunc);
};
ItemRegistry.onProjectileHit = function(projectile, item, target) {
    this.__func = this.throwableFunctions[item.id];
    if (this.__func) this.__func(projectile, item, target);
};

ItemRegistry.iconOverrideFunctions = {};
ItemRegistry.registerIconOverrideFunction = function(namedID, func) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    Item.setRequiresIconOverride(numericID, true);
    this.iconOverrideFunctions[numericID] = func;
};
ItemRegistry.onIconOverride = function(item) {
    var func = this.iconOverrideFunctions[item.id];
    if (func) {
        var res = func(item);
        if (res) Item.overrideCurrentIcon(res.name, res.data || res.meta || 0);
    }
};

ItemRegistry.nameOverrideFunctions = {};
ItemRegistry.setItemNameOverrideCallbackForced = requireMethodFromNativeAPI("api.NativeAPI", "setItemNameOverrideCallbackForced");
ItemRegistry.registerNameOverrideFunction = function(namedID, func, preventForcing) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    if (!preventForcing) this.setItemNameOverrideCallbackForced(numericID, true);
    this.nameOverrideFunctions[numericID] = func;
};
ItemRegistry.onNameOverride = function(item, name, translation) {
    var func = this.nameOverrideFunctions[item.id];
    if (func) {
        var res = func(item, name, translation);
        if (typeof (res) == "string") Item.overrideCurrentName(res);
    }
};

ItemRegistry.noTargetUseFunctions = {};
ItemRegistry.registerNoTargetUseFunction = function(namedID, func) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    this.noTargetUseFunctions[numericID] = func;
};
ItemRegistry.onUseNoTarget = function(item) {
    var func = this.noTargetUseFunctions[item.id];
    if (func) func(item);
};

ItemRegistry.usingReleasedFunctions = {};
ItemRegistry.registerUsingReleasedFunction =function(namedID, func) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    this.usingReleasedFunctions[numericID] = func;
};
ItemRegistry.onUsingReleased = function(item, ticks) {
    var func = this.usingReleasedFunctions[item.id];
    if (func) func(item, ticks);
};

ItemRegistry.usingCompleteFunctions = {};
ItemRegistry.registerUsingCompleteFunction = function(namedID, func) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    this.usingCompleteFunctions[numericID] = func;
};
ItemRegistry.onUsingComplete = function(item) {
    var func = this.usingCompleteFunctions[item.id];
    if (func) func(item);
};

ItemRegistry.dispenseFunctions = {};
ItemRegistry.registerDispenseFunction = function(namedID, func) {
    var numericID = this.getNumericId(namedID);
    if (numericID == -1) return false;
    this.dispenseFunctions[numericID] = func;
};
ItemRegistry.onDispense = function(coords, item) {
    var func = this.dispenseFunctions[item.id];
    if (func) func(coords, item);
};

ItemRegistry.invokeItemUseOn = function(coords, item, noModCallback, entity) {
    var vec = coords.vec = coords.vec || {x: (coords.x || 0) + .5, y: (coords.y || 0) + .5, z: (coords.z || 0) + .5};
    if (!noModCallback) {
        var block = WorldAPI.getBlock(coords.x, coords.y, coords.z);
        Callback.invokeCallback("ItemUse", coords, item, block);
    }
    if (noModCallback || !MCSystem.isDefaultPrevented())
        Item.invokeItemUseOn(item.id, item.count, item.data, item.extra, coords.x, coords.y, coords.z, coords.side || 0, vec.x, vec.y, vec.z, entity);
};
ItemRegistry.invokeItemUseNoTarget = function(item, noModCallback) {
    if (!noModCallback) Callback.invokeCallback("ItemUseNoTarget", item);
    if (noModCallback || !MCSystem.isDefaultPrevented())
        Item.invokeItemUseNoTarget(item.id, item.count, item.data, item.extra);
};

Callback.addCallback("ProjectileHit", function(projectile, item, target) {
    if (item) ItemRegistry.onProjectileHit(projectile, item, target);
});
Callback.addCallback("ItemIconOverride", function(item) {
    ItemRegistry.onIconOverride(item);
});
Callback.addCallback("ItemNameOverride", function(item, name, translation) {
    ItemRegistry.onNameOverride(item, name, translation);
});
Callback.addCallback("ItemUseNoTarget", function(item, ticks) {
    ItemRegistry.onUseNoTarget(item, ticks);
});
Callback.addCallback("ItemUsingReleased", function(item, ticks) {
    ItemRegistry.onUsingReleased(item, ticks);
});
Callback.addCallback("ItemUsingComplete", function(item) {
    ItemRegistry.onUsingComplete(item);
});
Callback.addCallback("ItemDispensed", function(coords, item) {
    ItemRegistry.onDispense(coords, item);
});


var ArmorRegistry = {};
ArmorRegistry.registerFuncs = function(id, funcs) {
    var id = ItemRegistry.getNumericId(id);
    if (id == -1) return;
    Armor.registerCallbacks(id, funcs);
};
ArmorRegistry.preventDamaging = function(id) {
    var id = ItemRegistry.getNumericId(id);
    if (id == -1) return;
    Armor.preventDamaging(id);
};

var ToolAPI = {};
ToolAPI.needDamagableItemFix = false;

ToolAPI.blockMaterials = {};
ToolAPI.addBlockMaterial = function(name, breakingMultiplier) {
    this.blockMaterials[name] = { multiplier: breakingMultiplier, name: name };
};

ToolAPI.toolMaterials = {};
ToolAPI.addToolMaterial = function(name, material) {
	if (!material) material = {};
    if (!material.efficiency) material.efficiency = 1;
    if (!material.damage) material.damage = 0;
    if (!material.durability) material.durability = 1;
    if (!material.level) material.level = 0;
    material.name = name;
    this.toolMaterials[name] = material;
};

ToolAPI.toolData = {};
ToolAPI.registerTool = function(id, toolMaterial, blockMaterials, params) {
    if (!params) params = {};
    if (!params.brokenId) params.brokenId = 0;
    if (!params.damage) params.damage = 0;
    if (typeof (toolMaterial) != "object")
		params.toolMaterial = this.toolMaterials[toolMaterial];
	else params.toolMaterial = toolMaterial;
    if (!params.toolMaterial) {
        Logger.Log("Item " + id + " cannot be registred as tool: tool material " + toolMaterial + " not found", "ERROR");
        return;
    }
    params.blockMaterials = {};
    for (var i in blockMaterials)
        params.blockMaterials[blockMaterials[i]] = true;
    if (!params.calcDestroyTime)
        params.calcDestroyTime = function(tool, coords, block, timeData, defaultTime) {
            return defaultTime;
        };
    this.toolData[id] = params;
    if (!params.isNative)
        ItemRegistry.setMaxDamage(id, params.toolMaterial.durability);
};
ToolAPI.registerSword = function(id, toolMaterial, params) {
    params = params || {};
    params.isWeapon = true;
    this.registerTool(id, toolMaterial, ["fibre"], params);
};

ToolAPI.blockData = {};
ToolAPI.registerBlockMaterial = function(uid, materialName, level, isNative) {
    var material = this.blockMaterials[materialName];
    if (!material) {
        Logger.Log("Material for block " + uid + " cannot be registred: material " + materialName + " not found", "ERROR");
        return;
    }
    this.blockData[uid] = { material: material, level: level || 0, isNative: isNative };
};
ToolAPI.registerBlockDiggingLevel = function(uid, level) {
    if (this.blockData[uid]) this.blockData[uid].level = level;
    else Logger.Log("Digging level for block " + uid + " cannot be registred: block has no material", "ERROR");
};
ToolAPI.registerBlockMaterialAsArray = function(materialName, UIDs, isNative) {
    for (var i in UIDs) this.registerBlockMaterial(UIDs[i], materialName, 0, isNative);
};

ToolAPI.refresh = function() {};
ToolAPI.getBlockData = function(blockID) {
    return this.blockData[blockID];
};
ToolAPI.getBlockMaterial = function(blockID) {
    var data = this.getBlockData(blockID);
    if (data) return data.material;
    return null;
};
ToolAPI.getBlockDestroyLevel = function(blockID) {
    var data = this.getBlockData(blockID);
    if (data) return data.level;
    return 0;
};
ToolAPI.getEnchantExtraData = function(extra) {
	var enchant = {
		silk: false,
		fortune: 0,
		efficiency: 0,
		unbreaking: 0,
		experience: 0
    };

	if (extra) {
		var enchants = extra.getEnchants();
		for (var i in enchants) {
			if (i == 15) enchant.efficiency = enchants[i];
			if (i == 16) enchant.silk = true;
			if (i == 17) enchant.unbreaking = enchants[i];
			if (i == 18) enchant.fortune = enchants[i];
		}
	}
	return enchant;
};
ToolAPI.fortuneDropModifier = function(drop, level) {
    var len = drop.length;
	for (var i = 0; i < len; i++) {
		var extraCount = parseInt(Math.random() * (level + 2)) - 1;
		for (var j = 0; j < extraCount; j++) drop.push(drop[i]);
	}
	return drop;
};
ToolAPI.getDestroyTimeViaTool = function(fullBlock, toolItem, coords, ignoreNative) {
    var baseDestroyTime = Block.getDestroyTime(fullBlock.id);
    var toolData = this.toolData[toolItem.id];
    var blockData = this.getBlockData(fullBlock.id);
    if (!blockData) return baseDestroyTime;
    var blockMaterial = blockData.material;
    var blockLevel = blockData.level;
    if (!blockMaterial) return baseDestroyTime;
    if (!toolData) {
        if (blockData.isNative) return baseDestroyTime;
        else return baseDestroyTime * blockMaterial.multiplier;
    }
    if (toolData.isNative && blockData.isNative && !ignoreNative)
        return baseDestroyTime;
    var canMine = toolData.blockMaterials[blockMaterial.name] && toolData.toolMaterial.level >= blockLevel;
    var enchantData = this.getEnchantExtraData(toolItem.extra);
    if (toolData.modifyEnchant) toolData.modifyEnchant(enchantData, toolItem, coords, fullBlock);
    var devider = 1;
    var modifier = 1;
    if (canMine) {
        devider = toolData.toolMaterial.efficiency;
        if (blockData.isNative) devider *= blockMaterial.multiplier;
        modifier = Math.pow(1.3, Math.pow(2, enchantData.efficiency) - 1);
    } else if (!blockData.isNative) baseDestroyTime *= blockMaterial.multiplier;
    return toolData.calcDestroyTime(toolItem, coords, fullBlock,
	    { base: baseDestroyTime, devider: devider, modifier: modifier },
		baseDestroyTime / devider / modifier, enchantData);
};
ToolAPI.getToolData = function(itemID) {
    return this.toolData[itemID] || null;
};
ToolAPI.getToolLevel = function(itemID) {
    var data = this.getToolData(itemID);
    if (data) return data.toolMaterial.level;
    return 0;
};
ToolAPI.getToolLevelViaBlock = function(itemID, blockID) {
    var toolData = this.getToolData(itemID);
    var blockMaterial = this.getBlockMaterial(blockID);
    if (!toolData || !blockMaterial) return 0;
    if (toolData.blockMaterials[blockMaterial.name])
        return toolData.toolMaterial.level;
    return 0;
};
ToolAPI.getCarriedToolData = function() {
    return this.getToolData(Player.getCarriedItem().id);
};
ToolAPI.getCarriedToolLevel = function() {
    return this.getToolLevel(Player.getCarriedItem().id);
};

ToolAPI.startDestroyHook = function(coords, block, carried) {
    var destroyTime = this.getDestroyTimeViaTool(block, carried, coords);
    if (block.id == 73) Block.setTempDestroyTime(74, destroyTime); // handle Redstone Ore
	else if (block.id == 74) Block.setTempDestroyTime(73, destroyTime);
    Block.setTempDestroyTime(block.id, destroyTime);
};
ToolAPI.destroyBlockHook = function(coords, block, item) {
	var toolData = this.getToolData(item.id);
	var enchant = this.getEnchantExtraData(item.extra);
	if (toolData && !toolData.isNative) {
		if (!(toolData.onDestroy && toolData.onDestroy(item, coords, block))) {
			if (toolData.modifyEnchant) toolData.modifyEnchant(enchant, item);
			if ((Block.getDestroyTime(block.id) > 0 || this.getToolLevelViaBlock(item.id, block.id) > 0) && Math.random() < 1 / (enchant.unbreaking + 1)) {
                if (GameAPI.isItemSpendingAllowed()) {
                    item.data++;
                    if (toolData.isWeapon) item.data++;
                }
			}
		}
		if (item.data >= toolData.toolMaterial.durability) {
			if (!(toolData.onBroke && toolData.onBroke(item))) {
				(item.id = toolData.brokenId, item.count = 1, item.data = 0);
				WorldAPI.playSoundAtEntity(Player.get(), "random.break", 1);
			}
		}
		Player.setCarriedItem(item.id, item.count, item.data, item.extra);
	}
};

ToolAPI.LastAttackTime = 0;
ToolAPI.playerAttackHook = function(attacker, victim, item) {
	var toolData = this.getToolData(item.id);
	var enchant = this.getEnchantExtraData(item.extra);
	var worldTime = WorldAPI.getThreadTime();
	var isTimeCorrect = this.LastAttackTime + 10 < worldTime;
	if (isTimeCorrect && toolData && !toolData.isNative && Entity.getHealth(victim) > 0) {
		if (!(toolData.onAttack && toolData.onAttack(item, victim))) {
			if (toolData.modifyEnchant) toolData.modifyEnchant(enchant, item);
            if (GameAPI.isItemSpendingAllowed()) {
                if (Math.random() < 1 / (enchant.unbreaking + 1)) {
                    item.data++;
                    if (!toolData.isWeapon) item.data++;
                }
            }
		}
		if (item.data >= toolData.toolMaterial.durability) {
			if (!(toolData.onBroke && toolData.onBroke(item))) {
				(item.id = toolData.brokenId, item.count = 1, item.data = 0);
				WorldAPI.playSoundAtEntity(Player.get(), "random.break", 1);
			}
		}
		var damage = toolData.damage + toolData.toolMaterial.damage;
		damage = Math.floor(damage) + (Math.random() < damage - Math.floor(damage) ? 1 : 0);
		EntityAPI.damageEntity(victim, damage, 2, {attacker: Player.get(), bool1: true});
		Player.setCarriedItem(item.id, item.count, item.data, item.extra);
		this.LastAttackTime = worldTime;
	}
};
ToolAPI.resetEngine = function() {
    this.LastAttackTime = 0;
    this.refresh();
};
ToolAPI.dropExpOrbs = function(x, y, z, value) {
    Level.spawnExpOrbs(x, y, z, value);
};
ToolAPI.dropOreExp = function(coords, minVal, maxVal, modifier) {
    this.dropExpOrbs(coords.x + 0.5, coords.y + 0.5, coords.z + 0.5,
	    minVal + parseInt(Math.random() * (maxVal - minVal + 1 + modifier)));
};
ToolAPI.getBlockMaterialName = function(blockID) {
	var data = this.getBlockData(blockID);
    if (data) return data.material.name;
    return null;
};

Callback.addCallback("DestroyBlock", function(coords, block) {
    var carried = Player.getCarriedItem();
    ToolAPI.destroyBlockHook(coords, block, carried);
});
Callback.addCallback("DestroyBlockStart", function(coords, block) {
    var carried = Player.getCarriedItem();
    ToolAPI.startDestroyHook(coords, block, carried);
});
Callback.addCallback("PlayerAttack", function(attackerPlayer, victimEntity) {
    var carried = Player.getCarriedItem();
    ToolAPI.playerAttackHook(attackerPlayer, victimEntity, carried);
});
Callback.addCallback("PostLoaded", function() {
    ToolAPI.resetEngine();
});

/* register native MCPE items, blocks and materials in ToolAPI */

/* --------------- tool materials ---------------- */
ToolAPI.addToolMaterial("wood", {
	level: 1,
	durability: 60,
	damage: 2,
	efficiency: 2
});

ToolAPI.addToolMaterial("stone", {
	level: 2,
	durability: 132,
	damage: 3,
	efficiency: 4
});

ToolAPI.addToolMaterial("iron", {
	level: 3,
	durability: 251,
	damage: 4,
	efficiency: 6
});

ToolAPI.addToolMaterial("golden", {
	level: 1,
	durability: 33,
	damage: 2,
	efficiency: 12
});

ToolAPI.addToolMaterial("diamond", {
	level: 4,
	durability: 1562,
	damage: 5,
	efficiency: 8
});

/* --------------- block materials ---------------- */
ToolAPI.addBlockMaterial("stone", 10 / 3); // +
ToolAPI.addBlockMaterial("wood", 1); // +
ToolAPI.addBlockMaterial("dirt", 1); // +
ToolAPI.addBlockMaterial("plant", 1); // +
ToolAPI.addBlockMaterial("fibre", 1); // +
ToolAPI.addBlockMaterial("cobweb", 10 / 3); // +
ToolAPI.addBlockMaterial("unbreaking", 999999999); // +

/* -------------- tool registration --------------- */
// pickaxes
ToolAPI.registerTool(270, "wood", ["stone"], { isNative: true, damage: 1 }); // wooden
ToolAPI.registerTool(274, "stone", ["stone"], { isNative: true, damage: 1 }); // stone
ToolAPI.registerTool(257, "iron", ["stone"], { isNative: true, damage: 1 }); // iron
ToolAPI.registerTool(285, "golden", ["stone"], { isNative: true, damage: 1 }); // golden
ToolAPI.registerTool(278, "diamond", ["stone"], { isNative: true, damage: 1 }); // diamond

// axes 
ToolAPI.registerTool(271, "wood", ["wood"], { isNative: true, damage: 2 }); // wooden
ToolAPI.registerTool(275, "stone", ["wood"], { isNative: true, damage: 2 }); // stone
ToolAPI.registerTool(258, "iron", ["wood"], { isNative: true, damage: 2 }); // iron
ToolAPI.registerTool(286, "golden", ["wood"], { isNative: true, damage: 2 }); // golden
ToolAPI.registerTool(279, "diamond", ["wood"], { isNative: true, damage: 2 }); // diamond

// shovels 
ToolAPI.registerTool(269, "wood", ["dirt"], { isNative: true, damage: 0 }); // wooden
ToolAPI.registerTool(273, "stone", ["dirt"], { isNative: true, damage: 0 }); // stone
ToolAPI.registerTool(256, "iron", ["dirt"], { isNative: true, damage: 0 }); // iron
ToolAPI.registerTool(284, "golden", ["dirt"], { isNative: true, damage: 0 }); // golden
ToolAPI.registerTool(277, "diamond", ["dirt"], { isNative: true, damage: 0 }); // diamond

/* -------------- block registration --------------- */
ToolAPI.registerBlockMaterialAsArray("stone", [
	1, // stone 
	4, // cobblestone
	14, // gold ore
	15, // iron ore
	16, // coal ore
	21, // lapis ore
	22, // lapis block
	23, // dispenser
	24, // sandstone
	27, // power rail
	28, // trigger rail
	29, // sticky piston,
	33, // piston
	41, // gold block
	42, // iron block
	43, // double stone slab
	44, // stone slab
	45, // bricks
	48, // mossy cobblestone
	49, // obsidian
	52, // spawner
	56, // diamond ore
	57, // diamond block
	61, 62, // furnace
	66, // rail
	67, // cobble stairs
	70, // pressure plate (stone)
	71, // iron door
	73, 74, // redstone ore
	77, // stone button
	79, // ice
	87, // netherrack
	89, // glowstone
	97, // monster egg
	98, // stone brick
	101, // iron bars
	108, 109, // brick stairs
	112, 113, 114, // nether brick blocks
	116, // enchanting table
	117, // brewing stand
	118, // cauldron
	120, 121, // end blocks
	123, 124, // lamp
	125, // dropper
	126, // activator rail
	128, // sandstone stairs
	129, // emerald ore
	130, // ender chest
	133, // emerald block
	138, // beacon
	139, // cobblestone wall
	145, // anvil
	147, 148, // pressure plates
	152, // redstone block
	153, // nether quartz
	154, // hopper
	155, 156, // quartz
	159, // stained clay
	167, // iron trapdoor
	168, // prismarine
	172, // hardened clay
	173, // coal block
	174, // packed ice
	179, 180, // red sandstone
	181, // double stone slab 2
	182, // stone slab 2
	201, // purpur
	203, // purpur stairs
	205, // shulker box (undyed)
	206, // end brick
	213, // magma
	215, // red nether brick
	216, // bone block
	218, // shulker box
	219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 231, 232, 233, 234, 235, // glazed terracotta
	236, // concrete
	245, // stonecutter
	251, // observer,
	257, 258, 259, // prismarine stairs
	266, // blue ice
	387, // coral block
	412, // conduit
	417, // stone slab 3
	421, // stone slab 4
	422, // double stone slab 3
	423, // double stone slab 4
	424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, // stone stairs
	438, // smooth stone
	439, // red nether brick stairs
	440, // smooth quartz stairs
	450, // grindstone
	451, 469, // blast furnace
	452, // stonecutter
	453, 454, // smoker
	461, // bell
	463, // lantern
	465, // lava cauldron
], true);

ToolAPI.registerBlockMaterialAsArray("wood", [
	5, // planks
	17, // log1
	25, // note block
	47, // bookshelf
	53, // oak stairs
	54, // chest
	58, // workbench
	63, 68, // oak sign
	64, // door
	65, // ladder
	72, // wooden pressure plate
	85, // fence
	86, 91, // pumpkin
	96, // wooden trapdoor
	99, 100, // mushroom
	103, // melon
	107, // fence gate
	127, // cocoa
	134, 135, 136, 163, 164, // wood stairs
	143, // wooden button
	146, // trapped chest
	151, 178, // daylight sensor
	157, // wooden double slab
	158, // wooden slab
	162, // log2
	183, 184, 185, 186, 187, // fence gate 2
	193, 194, 195, 196, 197, // door 2
	260, 261, 262, 263, 264, 265, // stripped log
	395, 396, 397, 398, 399, // wooden button 2
	400, 401, 402, 403, 404, // wooden trapdoor 2
	405, 406, 407, 408, 409, // wooden pressure plate 2
	410, // carved pumpkin
	436, 437, // spruce sign
	441, 442, // birch sign
	443, 444, // acacia sign
	445, 446, // dark oak sign
	449, // lectern
	455, // cartography table
	456, // fletching table
	457, // smithing table
	458, // barrel
	459, // loom
	464, // campfire
	467, // wood
	468, // composter
], true);

ToolAPI.registerBlockMaterialAsArray("dirt", [
	2, // grass
	3, // dirt
	12, // sand
	13, // gravel
	60, // farmland
	78, 80, // snow
	82, // clay
	88, // soul sand
	110, // mycelium
	198, // grass path
	237, // concrete
	243, // podzol
], true);

ToolAPI.registerBlockMaterialAsArray("fibre", [
	30, // web
], true);


ToolAPI.registerBlockMaterialAsArray("plant", [
	6, // sapling
	18, 161, // leaves
	31, 32, // grass
	81, // cactus
	106, // vine
	111, // lilypad
	175, // tall grass
], true);


ToolAPI.registerBlockMaterialAsArray("cobweb", [
	// for older versions
], true);

ToolAPI.registerBlockMaterialAsArray("unbreaking", [
	8, 9, 10, 11, // liquid
	7, 95, // bedrock
	90, 119, 120, // portal blocks
	137, 188, 189 // command block
], true);

/* --------------- DESTROY FUNCS ---------------- */
BlockRegistry.registerDropFunctionForID(1, function(coords, id, data, level, enchant) { // stone
	if (level > 0) {
		if (data == 0 && !enchant.silk) return [[4, 1, 0]];
		else return [[id, 1, data]];
	}
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(2, function(coords, id, data, level, enchant) { //grass
	if (enchant.silk) return [[2, 1, 0]];
	return [[3, 1, 0]];
});

BlockRegistry.setDestroyLevelForID(4, 1); // cobblestone

BlockRegistry.registerDropFunctionForID(13, function(coords, id, data, level, enchant) { // gravel
	if (Math.random() < [0.1, 0.14, 0.25, 1][enchant.fortune || 0]) return [[318, 1, 0]];
	return [[13, 1, 0]];
});

BlockRegistry.setDestroyLevelForID(14, 3); // gold ore
BlockRegistry.setDestroyLevelForID(15, 2); // iron ore

BlockRegistry.registerDropFunctionForID(16, function(coords, id, data, level, enchant) { // coal ore
	if (level >= 1) {
		if (enchant.silk) return [[id, 1, data]];
		ToolAPI.dropOreExp(coords, 0, 2, enchant.experience);
		return ToolAPI.fortuneDropModifier([[263, 1, 0]], enchant.fortune);
	}
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(20, function(coords, id, data, level, enchant) { // glass
	if (enchant.silk) return [[20, 1, 0]];
	return [];
});

BlockRegistry.registerDropFunctionForID(21, function(coords, id, data, level, enchant) { // lapis ore
	if (level >= 1) {
		if (enchant.silk) return [[id, 1, data]];
		var drop = [];
		var count = 4 + parseInt(Math.random() * 6);
		for (var i = 0; i < count; i++) drop.push([351, 1, 4]);
		ToolAPI.dropOreExp(coords, 2, 5, enchant.experience);
		return ToolAPI.fortuneDropModifier(drop, enchant.fortune);
	}
	return [];
}, 2);

BlockRegistry.setDestroyLevelForID(22, 2); // lapis block
BlockRegistry.setDestroyLevelForID(23, 1, true); // dispenser
BlockRegistry.setDestroyLevelForID(24, 1); // sandstone

BlockRegistry.registerDropFunctionForID(30, function(coords, id, data, level, enchant) { // cobweb
	if (level >= 1) {
		if (enchant.silk) return [[id, 1, 0]];
		return [[287, 1, 0]];
	}
	return [];
}, 1);

BlockRegistry.setDestroyLevelForID(41, 3); // gold block
BlockRegistry.setDestroyLevelForID(42, 2); // iron block

BlockRegistry.registerDropFunctionForID(43, function(coords, id, data, level) { // double slab
	if (level >= 1) return [[44, 1, data], [44, 1, data]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(44, function(coords, id, data, level) { // stone slabs
	if (level >= 1) return [[id, 1, data % 8]];
	return [];
}, 1); 

BlockRegistry.setDestroyLevelForID(45, 1); // bricks
BlockRegistry.setDestroyLevelForID(48, 1); // mossy cobblestone
BlockRegistry.setDestroyLevelForID(49, 4); // obsidian

BlockRegistry.registerDropFunctionForID(52, function(coords, id, data, level, enchant) { // mob spawner
	ToolAPI.dropOreExp(coords, 15, 43, enchant.experience);
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(56, function(coords, id, data, level, enchant) { // diamond ore
	if (level >= 3) {
		if (enchant.silk) return [[id, 1, data]];
		ToolAPI.dropOreExp(coords, 3, 7, enchant.experience);
		return ToolAPI.fortuneDropModifier([[264, 1, 0]], enchant.fortune);
	}
	return [];
}, 3);

BlockRegistry.setDestroyLevelForID(57, 3); // diamond block
BlockRegistry.setDestroyLevelForID(61, 1, true); // furnace
BlockRegistry.registerDropFunctionForID(62, function(coords, id, data, level, enchant) { // burning furnace
	if (level >= 1) return [[61, 1, 0]];
	return [];
}, 1);

BlockRegistry.setDestroyLevelForID(67, 1, true); // cobble stairs
BlockRegistry.setDestroyLevelForID(70, 1, true); // pressure plate
BlockRegistry.registerDropFunctionForID(71, function(coords, id, data, level, enchant) { // iron door
	if (level >= 2) return [[330, 1, 0]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(73, function(coords, id, data, level, enchant) { // redstone ore
	if (level >= 3) {
		if (enchant.silk) return [[id, 1, data]];
		ToolAPI.dropOreExp(coords, 2, 5, enchant.experience);
		var drop = [];
		var count = 4 + parseInt(Math.random() * (2 + enchant.fortune));
		for (var i = 0; i < count; i++) drop.push([331, 1, 0]);
		return drop;
	}
	return [];
}, 3);

BlockRegistry.registerDropFunctionForID(74, function(coords, id, data, level, enchant) { // redstone ore
	if (level >= 3) {
		if (enchant.silk) return [[73, 1, data]];
		ToolAPI.dropOreExp(coords, 2, 5, enchant.experience);
		var drop = [];
		var count = 4 + parseInt(Math.random() * (2 + enchant.fortune));
		for (var i = 0; i < count; i++) drop.push([331, 1, 0]);
		return drop;
	}
	return [];
}, 3);

BlockRegistry.registerDropFunctionForID(78, function(coords, id, data, level, enchant) { // snow layer
	if (level > 0) {
		if (data % 8 == 7) return [[332, 4, 0]];
		if (data % 8 >= 5) return [[332, 3, 0]];
		if (data % 8 >= 3) return [[332, 2, 0]];
		return [[332, 1, 0]];
	}
	return [];
});
BlockRegistry.registerDropFunctionForID(80, function(coords, id, data, level, enchant) { // snow block
	if (enchant.silk) return [[80, 1, 0]];
	return [[332, 1, 0], [332, 1, 0], [332, 1, 0], [332, 1, 0]];
});

BlockRegistry.setDestroyLevelForID(87, 1); // netherrack
BlockRegistry.setDestroyLevelForID(98, 1); // stone brick
BlockRegistry.setDestroyLevelForID(101, 1); // iron bars

BlockRegistry.registerDropFunctionForID(102, function(coords, id, data, level, enchant) { // glass pane
	if (enchant.silk) return [[102, 1, 0]];
	return [];
});

BlockRegistry.setDestroyLevelForID(108, 1, true); // brick stairs
BlockRegistry.setDestroyLevelForID(109, 1, true); // stone brick stairs

BlockRegistry.registerDropFunctionForID(110, function(coords, id, data, level, enchant) { // mycelium
	if (enchant.silk) return [[110, 1, 0]];
	return [[3, 1, 0]];
});

BlockRegistry.setDestroyLevelForID(112, 1); // nether brick
BlockRegistry.setDestroyLevelForID(113, 1); // nether brick fence
BlockRegistry.setDestroyLevelForID(114, 1, true); // nether brick stairs
BlockRegistry.setDestroyLevelForID(116, 1); // ench table

BlockRegistry.registerDropFunctionForID(117, function(coords, id, data, level) { // brewing stand
	if (level >= 1) return [[379, 1, 0]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(118, function(coords,id, data, level) { // cauldron
	if (level >= 1) return [[380, 1, 0]];
	return [];
}, 1);

BlockRegistry.setDestroyLevelForID(121, 1); // end stone
BlockRegistry.setDestroyLevelForID(125, 1, true); // dropper
BlockRegistry.setDestroyLevelForID(128, 1, true); // sandstone stairs

BlockRegistry.registerDropFunctionForID(129, function(coords, id, data, level, enchant) { // emerald ore
	if (level >= 3) {
		if (enchant.silk) return [[id, 1, data]];
		ToolAPI.dropOreExp(coords, 3, 7, enchant.experience);
		return ToolAPI.fortuneDropModifier([[388, 1, 0]], enchant.fortune);
	}
	return [];
}, 3);

BlockRegistry.registerDropFunctionForID(130, function(coords, id, data, level, enchant) { // ender chest
	if (level >= 1) {
		if (enchant.silk) return [[id, 1, 0]];
		return [[49, 8, 0]];
	}
	return [];
}, 1);

BlockRegistry.setDestroyLevelForID(133, 3); // emerald block
BlockRegistry.setDestroyLevelForID(139, 1); // cobblestone wall
BlockRegistry.setDestroyLevelForID(145, 1); // anvil
BlockRegistry.setDestroyLevelForID(147, 1, true); // pressure plate
BlockRegistry.setDestroyLevelForID(148, 1, true); // pressure plate
BlockRegistry.setDestroyLevelForID(152, 1); // redstone block

BlockRegistry.registerDropFunctionForID(153, function(coords, id, data, level, enchant) { // nether quartz ore
	if (level >= 2) {
		if (enchant.silk) return [[id, 1, data]];
		ToolAPI.dropOreExp(coords, 2, 5, enchant.experience);
		return ToolAPI.fortuneDropModifier([[406, 1, 0]], enchant.fortune);
	}
	return [];
}, 2);

BlockRegistry.registerDropFunctionForID(154, function(coords, id, data, level) { // hopper
	if (level >= 1) return [[410, 1, 0]];
	return [];
}, 1);

BlockRegistry.setDestroyLevelForID(155, 1); // quartz
BlockRegistry.setDestroyLevelForID(156, 1, true); // quartz stairs
BlockRegistry.setDestroyLevelForID(159, 1); // stained clay

BlockRegistry.registerDropFunctionForID(160, function(coords, id, data, level, enchant) { // stained glass pane
	if (enchant.silk) return [[id, 1, data]];
	return [];
});

BlockRegistry.setDestroyLevelForID(167, 2, true); // iron trapdoor
BlockRegistry.setDestroyLevelForID(168, 1); // prismarine

BlockRegistry.registerDropFunctionForID(169, function(coords, id, data, level, enchant) { // sea lantern
	if (enchant.silk) return [[id, 1, data]];
	var drop = [];
	var count = 2 + parseInt(Math.random() * (2 + enchant.fortune));
	if (count > 5) count = 5;
	for (var i = 0; i < count; i++) drop.push([422, 1, 0]);
	return drop;
});

BlockRegistry.setDestroyLevelForID(172, 1); // hardened clay
BlockRegistry.setDestroyLevelForID(173, 1); // coal block
BlockRegistry.setDestroyLevelForID(179, 1); // red sandstone
BlockRegistry.setDestroyLevelForID(180, 1, true); // red sandstone stairs

BlockRegistry.registerDropFunctionForID(181, function(coords, id, data, level, enchant) { // double slab 2
	if (level >= 1) return [[182, 1, data], [182, 1, data]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(182, function(coords, id, data, level, enchant) { // stone slab 2
	if (level >= 1) return [[id, 1, data % 8]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(194, function(coords, id, data, level, enchant) { // packed ice
	if (level >= 1 && enchant.silk) return [[194, 1, data]];
	return [];
});

BlockRegistry.registerDropFunctionForID(198, function(coords, id, data, level, enchant) { // grass path
	if (enchant.silk) return [[198, 1, 0]];
	return [[3, 1, 0]];
});

BlockRegistry.setDestroyLevelForID(201, 1); // purpur
BlockRegistry.setDestroyLevelForID(203, 1, true); // purpur stairs
BlockRegistry.setDestroyLevelForID(206, 1); // end brick
BlockRegistry.setDestroyLevelForID(213, 1); // magma
BlockRegistry.setDestroyLevelForID(215, 1); // red nether brick
BlockRegistry.setDestroyLevelForID(216, 1, true); // bone block

// glazed terracotta
BlockRegistry.setDestroyLevelForID(219, 1, true);
BlockRegistry.setDestroyLevelForID(220, 1, true);
BlockRegistry.setDestroyLevelForID(221, 1, true);
BlockRegistry.setDestroyLevelForID(222, 1, true);
BlockRegistry.setDestroyLevelForID(223, 1, true);
BlockRegistry.setDestroyLevelForID(224, 1, true);
BlockRegistry.setDestroyLevelForID(225, 1, true);
BlockRegistry.setDestroyLevelForID(226, 1, true);
BlockRegistry.setDestroyLevelForID(227, 1, true);
BlockRegistry.setDestroyLevelForID(228, 1, true);
BlockRegistry.setDestroyLevelForID(229, 1, true);
BlockRegistry.setDestroyLevelForID(231, 1, true);
BlockRegistry.setDestroyLevelForID(232, 1, true);
BlockRegistry.setDestroyLevelForID(233, 1, true);
BlockRegistry.setDestroyLevelForID(234, 1, true);
BlockRegistry.setDestroyLevelForID(235, 1, true);

BlockRegistry.setDestroyLevelForID(236, 1); // concrete

BlockRegistry.registerDropFunctionForID(241, function(coords, id, data, level, enchant) { // stained glass
	if (enchant.silk) return [[id, 1, data]];
	return [];
});

BlockRegistry.setDestroyLevelForID(245, 1); // stonecutter
BlockRegistry.setDestroyLevelForID(251, 1, true); // observer

BlockRegistry.registerDropFunctionForID(243, function(coords, id, data, level, enchant) { // podzol
	if (enchant.silk) return [[243, 1, 0]];
	return [[3, 1, 0]];
});

// prismarine stairs
BlockRegistry.setDestroyLevelForID(257, 1, true);
BlockRegistry.setDestroyLevelForID(258, 1, true);
BlockRegistry.setDestroyLevelForID(259, 1, true);

BlockRegistry.registerDropFunctionForID(266, function(coords, id, data, level, enchant) { // blue ice
	if (level >= 1 && enchant.silk) return [[-11, 1, data]];
	return [];
});

BlockRegistry.registerDropFunctionForID(386, function(coords, id, data, level, enchant) { // coral
	if (level >= 1 && enchant.silk) return [[-131, 1, data]];
	return [];
});

BlockRegistry.registerDropFunctionForID(387, function(coords, id, data, level, enchant) { // coral block
	if (level >= 1) {
		if (enchant.silk) return [[-132, 1, data]];
		return [[-132, 1, data + 8]];
	}
	return [];
});

BlockRegistry.registerDropFunctionForID(388, function(coords, id, data, level, enchant) { // coral fan
	if (level >= 1 && enchant.silk) return [[-133, 1, data % 8]];
	return [];
});

BlockRegistry.registerDropFunctionForID(389, function(coords, id, data, level, enchant) { // dead coral fan
	if (level >= 1 && enchant.silk) return [[-134, 1, data % 8]];
	return [];
});

BlockRegistry.registerDropFunctionForID(390, function(coords, id, data, level, enchant) { // wall coral fan
	if (level >= 1 && enchant.silk) {
		var itemID = (data % 4 < 2) ? -133 : -134;
		return [[itemID, 1, data % 2]];
	}
	return [];
});

BlockRegistry.registerDropFunctionForID(391, function(coords, id, data, level, enchant) { // wall coral fan 2
	if (level >= 1 && enchant.silk) {
		var itemID = (data % 4 < 2) ? -133 : -134;
		return [[itemID, 1, data % 2 + 2]];
	}
	return [];
});

BlockRegistry.registerDropFunctionForID(392, function(coords, id, data, level, enchant) { // wall coral fan 3
	if (level >= 1 && enchant.silk) {
		var itemID = (data % 4 == 0) ? -133 : -134;
		return [[itemID, 1, 4]];
	}
	return [];
});

BlockRegistry.registerDropFunctionForID(417, function(coords, id, data, level, enchant) { // stone slab 3
	if (level >= 1) return [[-162, 1, data % 8]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(421, function(coords, id, data, level, enchant) { // stone slab 4
	if (level >= 1) return [[-166, 1, data % 8]];
	return [];
}, 1); 

BlockRegistry.registerDropFunctionForID(422, function(coords, id, data, level, enchant) { // double slab 3
	if (level >= 1) return [[-162, 1, data], [-161, 1, data]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(423, function(coords, id, data, level, enchant) { // double slab 4
	if (level >= 1) return [[-166, 1, data], [-166, 1, data]];
	return [];
}, 1);

// stone stairs
BlockRegistry.setDestroyLevelForID(424, 1, true);
BlockRegistry.setDestroyLevelForID(425, 1, true);
BlockRegistry.setDestroyLevelForID(426, 1, true);
BlockRegistry.setDestroyLevelForID(427, 1, true);
BlockRegistry.setDestroyLevelForID(428, 1, true);
BlockRegistry.setDestroyLevelForID(429, 1, true);
BlockRegistry.setDestroyLevelForID(430, 1, true);
BlockRegistry.setDestroyLevelForID(431, 1, true);
BlockRegistry.setDestroyLevelForID(432, 1, true);
BlockRegistry.setDestroyLevelForID(433, 1, true);
BlockRegistry.setDestroyLevelForID(434, 1, true);
BlockRegistry.setDestroyLevelForID(435, 1, true);

BlockRegistry.setDestroyLevelForID(438, 1); // smooth stone
BlockRegistry.setDestroyLevelForID(439, 1, true); // red nether brick stairs
BlockRegistry.setDestroyLevelForID(440, 1, true); // smooth quartz stairs
BlockRegistry.setDestroyLevelForID(450, 1, true); // grindstone
BlockRegistry.setDestroyLevelForID(451, 1, true); // blast furnace
BlockRegistry.setDestroyLevelForID(452, 1, true); // stonecutter
BlockRegistry.setDestroyLevelForID(453, 1, true); // smoker

BlockRegistry.registerDropFunctionForID(454, function(coords, id, data, level) { // lit smoker
	if (level >= 1) return [[BlockRegistry.convertBlockToItemId(453), 1, 0]];
	return [];
}, 1);
BlockRegistry.setDestroyLevelForID(461, 1, true); // bell
BlockRegistry.setDestroyLevelForID(463, 1, true); // lantern

BlockRegistry.registerDropFunctionForID(465, function(coords,id, data, level) { // lava cauldron
	if (level >= 1) return [[380, 1, 0]];
	return [];
}, 1);

BlockRegistry.registerDropFunctionForID(469, function(coords, id, data, level) { // lit blast furnace
	if (level >= 1) return [[BlockRegistry.convertBlockToItemId(451), 1, 0]];
	return [];
}, 1);

// ice
Callback.addCallback("DestroyBlock", function(coords, block, player) {
	if (block.id == 79) {
		var item = Player.getCarriedItem();
		var enchant = ToolAPI.getEnchantExtraData(item.extra);
		var toolData = ToolAPI.getToolData(item.id);
		if (!toolData.isNative && GameAPI.isItemSpendingAllowed()) {
			if (toolData && toolData.modifyEnchant) toolData.modifyEnchant(enchant, item);
			if (ToolAPI.getToolLevelViaBlock(item.id, block.id) > 0 && enchant.silk) {
				Level.destroyBlock(coords.x, coords.y, coords.z);
				Level.dropItem(coords.x + .5, coords.y + .5, coords.z + .5, 0, block.id, 1);
			}
		}
	}
});



var LiquidRegistry = {};
LiquidRegistry.liquidStorageSaverId = Saver.registerObjectSaver("_liquidStorage", {
	read: function(obj) {
        var storage = new LiquidRegistry.Storage();
        storage.read(obj);
        return storage;
	},
	save: function(obj) {
		if (obj) return obj.save();
	}
});

LiquidRegistry.liquids = {};
LiquidRegistry.registerLiquid = function(key, name, uiTextures, modelTextures) {
    if (this.liquids[key]) Logger.Log("liquid key " + key + " is not unique, new liquid will replace old one", "WARNING");
    this.liquids[key] = {
		key: key,
		name: name || key,
		uiTextures: uiTextures || [],
		uiCache: {},
		modelTextures: modelTextures || [],
		addUITexture: function(name) {
            this.uiTextures.push(name);
		},
		addModelTexture: function(name) {
			this.modelTextures.push(name);
		}
	};
};
LiquidRegistry.getLiquidData = function(key) {
    return this.liquids[key];
};
LiquidRegistry.isExists = function(key) {
    if (this.liquids[key]) return true;
    return false;
};
LiquidRegistry.getLiquidName = function(key) {
    if (this.liquids[key]) return this.liquids[key].name;
};
LiquidRegistry.getLiquidUITexture = function(key, width, height) {
    var liquid = this.getLiquidData(key);
    if (liquid) {
        if (width && height) {
            var ratio = width / height;
            var best = { name: null, delta: 99999 };
            for (var i in liquid.uiTextures) {
                var name = liquid.uiTextures[i];
                var bitmap = UI.TextureSource.getNullable(name);
                if (bitmap) {
                    var delta = Math.abs(bitmap.width / bitmap.height - ratio);
                    if (delta < best.delta) (best.delta = delta, best.name = name);
                }
            }
            return best.name || "missing_texture";
        } else return liquid.uiTextures[0] || "missing_texture";
    }
    return "missing_texture";
};
LiquidRegistry.getLiquidUIBitmap = function(key, width, height) {
    var liquid = this.getLiquidData(key);
    if (liquid) {
        var ratio = width / height;
        var best = { bitmap: null, delta: 99999 };
        for (var i in liquid.uiTextures) {
            var name = liquid.uiTextures[i];
            var bitmap = UI.TextureSource.get(name);
            if (bitmap) {
                var delta = Math.abs(bitmap.width / bitmap.height - ratio);
                if (delta < best.delta) (best.delta = delta, best.bitmap = bitmap);
            }
        }
        if (best.bitmap) {
            if (width >= 1 && height >= 1) {
                return android.graphics.Bitmap.createScaledBitmap(best.bitmap, width, height, false);
            }
        }
    }
    return UI.TextureSource.get("missing_texture");
};

LiquidRegistry.FullByEmpty = {};
LiquidRegistry.EmptyByFull = {};
LiquidRegistry.registerItem = function(liquid, empty, full) {
    if (!this.getLiquidData(liquid) || !empty || !full) {
        Logger.Log("cannot register items for liquid " + key + ": some params are missing or invalid", "ERROR");
        return;
    }
    this.FullByEmpty[empty.id + ":" + empty.data + ":" + liquid] = { id: full.id, data: full.data };
    this.EmptyByFull[full.id + ":" + full.data] = { id: empty.id, data: empty.data, liquid: liquid };
};
LiquidRegistry.getEmptyItem = function(id, data) {
    if (this.EmptyByFull[id + ":" + data]) {
        return this.EmptyByFull[id + ":" + data];
    }
    if (this.EmptyByFull[id + ":-1"]) {
        return this.EmptyByFull[id + ":-1"];
    }
};
LiquidRegistry.getItemLiquid = function(id, data) {
    var empty = this.getEmptyItem(id, data);
    if (empty) return empty.liquid;
};
LiquidRegistry.getFullItem = function(id, data, liquid) {
    if (this.FullByEmpty[id + ":" + data + ":" + liquid]) {
        return this.FullByEmpty[id + ":" + data + ":" + liquid];
    }
    if (this.FullByEmpty[id + ":-1:" + liquid]) {
        return this.FullByEmpty[id + ":-1:" + liquid];
    }
};

LiquidRegistry.Storage = function(tileEntity) {
    this.liquidAmounts = {};
    this.liquidLimits = {};
    this.tileEntity = tileEntity;
    Saver.registerObject(this, LiquidRegistry.liquidStorageSaverId);
    this.setParent = function(obj) {
        this.tileEntity = obj;
    };
    this.getParent = function(obj) {
        return this.tileEntity;
    };
    this.hasDataFor = function(liquid) {
        return this.liquidAmounts[liquid] + "" != "undefined";
    };
    this.setLimit = function(liquid, limit) {
        if (liquid) this.liquidLimits[liquid] = limit;
		else this.liquidLimits.__global = limit;
    };
    this.getLimit = function(liquid) {
        return this.liquidLimits[liquid] || this.liquidLimits.__global || 99999999;
    };
    this.getAmount = function(liquid) {
        return this.liquidAmounts[liquid] || 0;
    };
    this.getRelativeAmount = function(liquid) {
        return this.getAmount(liquid) / this.getLimit(liquid);
    };
    this._setContainerScale = function(container, scale, liquid, val) {
        var size = container.getBinding(scale, "element_rect");
        if (!size) return;
        var texture = LiquidRegistry.getLiquidUITexture(liquid, size.width(), size.height());
        container.setBinding(scale, "texture", texture);
        container.setBinding(scale, "value", val);
    };
    this.updateUiScale = function(scale, liquid, container) {
        if (container) this._setContainerScale(container, scale, liquid, this.getRelativeAmount(liquid));
        else if (this.tileEntity && this.tileEntity.container)
			this._setContainerScale(this.tileEntity.container, scale, liquid, this.getRelativeAmount(liquid));
    };
    this.setAmount = function(liquid, amount) {
        this.liquidAmounts[liquid] = amount;
    };
    this.getLiquidStored = function() {
        for (var liquid in this.liquidAmounts)
            if (this.liquidAmounts[liquid] > 0)
                return liquid;
        return null;
    };
    this.isFull = function(liquid) {
        if (liquid) return this.getLimit(liquid) <= this.liquidAmounts[liquid];
        else {
            for (var name in this.liquidAmounts)
                if (name && !this.isFull(name))
                    return false;
            return true;
        }
    };
    this.isEmpty = function(liquid) {
        if (liquid) return this.liquidAmounts[liquid] <= 0;
        else {
            for (var name in this.liquidAmounts)
                if (name && !this.isEmpty(name))
                    return false;
            return true;
        }
    };
    this.addLiquid = function(liquid, amount, onlyFullAmount) {
        var limit = this.getLimit(liquid);
        var stored = this.getAmount(liquid);
        var result = stored + amount;
        var left = result - Math.min(limit, result);
        if (!onlyFullAmount || left <= 0) {
            this.setAmount(liquid, result - left);
            return Math.max(left, 0);
        }
        return amount;
    };
    this.getLiquid_flag = false;
    this.getLiquid = function(liquid, amount, onlyFullAmount) {
        var stored = this.getAmount(liquid);
        if (!this.getLiquid_flag && this.tileEntity && stored < amount) {
            this.getLiquid_flag = true;
            this.tileEntity.requireMoreLiquid(liquid, amount - stored);
            this.getLiquid_flag = false;
            stored = this.getAmount(liquid);
        }
        var got = Math.min(stored, amount);
        if (!onlyFullAmount || got >= amount) {
            this.setAmount(liquid, stored - got);
            return got;
        }
        return 0;
    };
    this.save = function() {
        return { amounts: this.liquidAmounts, limits: this.liquidLimits };
    };
    this.read = function(data) {
        if (data) {
            if (data.amounts) this.liquidAmounts = data.amounts;
            if (data.limits) this.liquidLimits = data.limits;
        }
    };
};

LiquidRegistry.registerLiquid("water", "water", ["_liquid_water_texture_0"]);
LiquidRegistry.registerLiquid("lava", "lava", ["_liquid_lava_texture_0"]);
LiquidRegistry.registerLiquid("milk", "milk", ["_liquid_milk_texture_0"]);
LiquidRegistry.registerItem("water", { id: 325, data: 0 }, { id: 325, data: 8 });
LiquidRegistry.registerItem("water", { id: 374, data: 0 }, { id: 373, data: 0 });
LiquidRegistry.registerItem("lava", { id: 325, data: 0 }, { id: 325, data: 10 });
LiquidRegistry.registerItem("milk", { id: 325, data: 0 }, { id: 325, data: 1 });



var NativeAPI_setTile = requireMethodFromNativeAPI("api.NativeAPI", "setTile");
var NativeAPI_getTileAndData = requireMethodFromNativeAPI("api.NativeAPI", "getTileAndData");
var NativeAPI_getTile = requireMethodFromNativeAPI("api.NativeAPI", "getTile");
var NativeAPI_getData = requireMethodFromNativeAPI("api.NativeAPI", "getData");

var WorldAPI = {};
WorldAPI.isLoaded = false;
WorldAPI.setLoaded = function(isLoaded) {
    this.isLoaded = isLoaded;
    var mode = null;
    if (this.isLoaded) {
        mode = this.__inworld;
        Logger.Log("World API switched into in-game mode", "API");
    } else {
        mode = this.__inmenu;
        Logger.Log("World API switched into in-menu mode", "API");
    }
    for (var name in mode) this[name] = mode[name];
};
WorldAPI.isWorldLoaded = function() {
    return this.isLoaded;
};

WorldAPI.getThreadTime = function() {
    return Updatable.getSyncTime();
};
WorldAPI.getRelativeCoords = function(x, y, z, side) {
    var directions = [
        { x: 0, y: -1, z: 0 }, // down
        { x: 0, y: 1, z: 0 }, // up
        { x: 0, y: 0, z: -1 }, // east
        { x: 0, y: 0, z: 1 }, // west
        { x: -1, y: 0, z: 0 }, // south
        { x: 1, y: 0, z: 0 } // north
    ];
    var dir = directions[side];
    return { x: x + dir.x, y: y + dir.y, z: z + dir.z };
};
WorldAPI.canTileBeReplaced = canTileBeReplaced;

WorldAPI.setBlockChangeCallbackEnabled = function(id, enabled) {
    Level.setBlockChangeCallbackEnabled(id, enabled);
};
WorldAPI.blockChangeCallbacks = [];
WorldAPI.registerBlockChangeCallback = function(ids, callback) {
    if (!Array.isArray(ids)) ids = [ids];
    for (var i in ids) {
        var id = ids[i];
        if (typeof(id) == "string") {
            var numericID = BlockRegistry.getNumericId(id);
            if (numericID == -1) {
                Logger.Log("invalid block name id " + id); 
                continue;
            }
            id = numericID;
        }
        Level.setBlockChangeCallbackEnabled(id, true);
        var callbacks = this.blockChangeCallbacks[id] || [];
        callbacks.push(callback);
        this.blockChangeCallbacks[id] = callbacks;
    }
};
WorldAPI.onBlockChanged = function(coords, block1, block2, int1, int2) {
    var callbacks = this.blockChangeCallbacks[block1.id];
    if (callbacks) for (var i in callbacks)
		callbacks[i](coords, block1, block2, int1, int2);
    if (block1.id != block2.id) {
        callbacks = this.blockChangeCallbacks[block2.id];
        if (callbacks) for (var i in callbacks)
			callbacks[i](coords, block1, block2, int1, int2);
    }
};
WorldAPI.addGenerationCallback = function(targetCallback, callback, uniqueHashStr) {
    if (!uniqueHashStr) uniqueHashStr = "hash:" + callback;
    var hash = 0;
    for (var i = 0; i < uniqueHashStr.length; i++) {
		var chr = uniqueHashStr.charCodeAt(i);
		hash = ((hash << 5) - hash) + chr;
		hash |= 0;
    }
    Callback.addCallback(targetCallback, function(chunkX, chunkZ, seededRandom, dimensionId, chunkSeed, worldSeed, dimensionSeed) {
        var callbackSeed = chunkSeed ^ hash;
        seededRandom.setSeed(callbackSeed);
        callback(chunkX, chunkZ, seededRandom, dimensionId, callbackSeed, worldSeed, dimensionSeed, chunkSeed);
    });
};

WorldAPI.__inworld = {};
WorldAPI.__inworld.nativeSetBlock = function(x, y, z, id, data) {
    NativeAPI_setTile(x, y, z, id, data);
};
WorldAPI.__inworld.nativeGetBlockID = function(x, y, z) {
    return NativeAPI_getTile(x, y, z);
};
WorldAPI.__inworld.nativeGetBlockData = function(x, y, z) {
    return NativeAPI_getData(x, y, z);
};
WorldAPI.__inworld.setBlock = NativeAPI_setTile;
WorldAPI.__inworld.setFullBlock = function(x, y, z, fullTile) {
    NativeAPI_setTile(x, y, z, fullTile.id, fullTile.data);
};
WorldAPI.__inworld.getBlock = function(x, y, z) {
    var tile = NativeAPI_getTileAndData(x, y, z);
    return {
		id: ((tile >> 24 == 1) ? -1 : 1) * (tile & 0xFFFF),
		data: ((tile >> 16) & 0xFF)
	};
};
WorldAPI.__inworld.getBlockID = NativeAPI_getTile;
WorldAPI.__inworld.getBlockData = NativeAPI_getData;
WorldAPI.__inworld.destroyBlock = function(x, y, z, drop) {
    var tile = this.getBlock(x, y, z);
    if (drop) BlockRegistry.onBlockDestroyed({ x: x, y: y, z: z }, tile, false);
    Level.destroyBlock(x, y, z, drop);
};
WorldAPI.__inworld.getLightLevel = requireMethodFromNativeAPI("api.NativeAPI", "getBrightness");
WorldAPI.__inworld.isChunkLoaded = function(x, z) {
    return Level.isChunkLoaded(x, z);
};
WorldAPI.__inworld.isChunkLoadedAt = function(x, y, z) {
    return Level.isChunkLoadedAt(x, y, z);
};
WorldAPI.__inworld.getChunkState = function(x, z) {
    return Level.getChunkState(x, z);
};
WorldAPI.__inworld.getChunkStateAt = function(x, y, z) {
    return Level.getChunkStateAt(x, y, z);
};
WorldAPI.__inworld.getTileEntity = function(x, y, z) {
    return TileEntity.getTileEntity(x, y, z);
};
WorldAPI.__inworld.addTileEntity = function(x, y, z) {
    return TileEntity.addTileEntity(x, y, z);
};
WorldAPI.__inworld.removeTileEntity = function(x, y, z) {
    return TileEntity.destroyTileEntityAtCoords(x, y, z);
};
WorldAPI.__inworld.getContainer = function(x, y, z) {
    var nativeTileEntity = Level.getTileEntity(x, y, z);
    if (nativeTileEntity) return nativeTileEntity;
    var id = NativeAPI_getTile(x, y, z);
    if (TileEntity.isTileEntityBlock(id)) {
        var tileEntity = this.getTileEntity(x, y, z);
        if (tileEntity && tileEntity.container)
            return tileEntity.container;
    }
    return null;
};
WorldAPI.__inworld.getWorldTime = function() {
    return Level.getTime();
};
WorldAPI.__inworld.setWorldTime = function(time) {
    return Level.setTime(time || 0);
};
WorldAPI.__inworld.setDayMode = function(day) {
    this.setNightMode(!day);
};
WorldAPI.__inworld.setNightMode = function(night) {
    Level.setNightMode(night);
};
WorldAPI.__inworld.getWeather = function() {
    return {
		rain: Level.getRainLevel(),
		thunder: Level.getLightningLevel()
	};
};
WorldAPI.__inworld.setWeather = function(weather) {
    if (weather) Level.setRainLevel(weather.rain || 0), Level.setLightningLevel(weather.thunder || 0);
};
WorldAPI.__inworld.drop = function(x, y, z, id, count, data, extra) {
    return Level.dropItem(x, y, z, 0, id, count, data, extra);
};
WorldAPI.__inworld.explode = function(x, y, z, power, someBoolean) {
    explode(x, y, z, power, someBoolean);
};
WorldAPI.__inworld.setBiomeMap = function(x, z, biome) {
    Level.setBiomeMap(x, z, biome);
};
WorldAPI.__inworld.getBiomeMap = function(x, z) {
    return Level.getBiomeMap(x, z);
};
WorldAPI.__inworld.setBiome = function(x, z, biome) {
    Level.getBiome(x, z, biome);
};
WorldAPI.__inworld.getBiome = function(x, z) {
    return Level.getBiome(x, z);
};
WorldAPI.__inworld.getBiomeName = function(x, z) {
    var biome = Level.getBiome(x, z);
    return Level.biomeIdToName(biome);
};
WorldAPI.__inworld.getBiomeNameById = function(biome) {
    return Level.biomeIdToName(biome);
};
WorldAPI.__inworld.getTemperature = function(x, y, z) {
    return Level.getTemperature(x, y, z);
};
WorldAPI.__inworld.getGrassColor = function(x, z) {
    return Level.getGrassColor(x, z);
};
WorldAPI.__inworld.setGrassColor = function(x, z, color) {
    return Level.setGrassColor(x, z, color || 0);
};
WorldAPI.__inworld.getGrassColorRGB = function(x, z) {
    var color = Level.getGrassColor(x, z);
    return {
		r: (color >> 16) & 255,
		g: (color >> 8) & 255,
		b: (color >> 0) & 255
	};
};
WorldAPI.__inworld.setGrassColorRGB = function(x, z, rgb) {
    var color = parseInt(rgb.r) * 256 * 256 + parseInt(rgb.g) * 256 + parseInt(rgb.b);
    return Level.setGrassColor(x, z, color);
};
WorldAPI.__inworld.canSeeSky = function(x, y, z) {
    return GenerationUtils.canSeeSky(x, y, z);
};
WorldAPI.__inworld.playSound = function(x, y, z, name, volume, pitch) {
    if (!pitch) pitch = 0.5;
    Level.playSound(x, y, z, name, volume, pitch);
};
WorldAPI.__inworld.playSoundAtEntity = function(entity, name, volume, pitch) {
    if (!pitch) pitch = 0.5;
    Level.playSoundEnt(entity, name, volume, pitch);
};

WorldAPI.__inmenu = {};
/* WorldAPI.__inmenu.nativeSetBlock = function(x, y, z, id, data) {};
WorldAPI.__inmenu.nativeGetBlockID = function(x, y, z) {
    return 0;
};
WorldAPI.__inmenu.nativeGetBlockData = function(x, y, z) {
    return 0;
};
WorldAPI.__inmenu.setBlock = function(x, y, z, id, data) {};
WorldAPI.__inmenu.setFullBlock = function(x, y, z, fullTile) {};
WorldAPI.__inmenu.getBlock = function(x, y, z) {
    return { id: 0, data: 0 };
};
WorldAPI.__inmenu.getBlockID = function(x, y, z) {
	return 0;
};
WorldAPI.__inmenu.getBlockData = function(x, y, z) {
	return 0;
};
WorldAPI.__inmenu.destroyBlock = function(x, y, z, drop) {};
WorldAPI.__inmenu.getLightLevel = function(x, y, z) {
	return 0;
};
WorldAPI.__inmenu.isChunkLoaded = function(x, z) {
    return false;
};
WorldAPI.__inmenu.isChunkLoadedAt = function(x, y, z) {
    return false;
};
WorldAPI.__inmenu.getChunkState = function(x, z) {
    return 0;
};
WorldAPI.__inmenu.getChunkStateAt = function(x, y, z) {
    return 0;
};
WorldAPI.__inmenu.getTileEntity = function(x, y, z) {
    return null;
};
WorldAPI.__inmenu.addTileEntity = function(x, y, z) {
    return null;
};
WorldAPI.__inmenu.removeTileEntity = function(x, y, z) {
    return false;
};
WorldAPI.__inmenu.getContainer = function(x, y, z) {
	return null;
};
WorldAPI.__inmenu.getWorldTime = function() {
    return 0;
};
WorldAPI.__inmenu.setWorldTime = function(time) {};
WorldAPI.__inmenu.setDayMode = function(day) {};
WorldAPI.__inmenu.setNightMode = function(night) {};
WorldAPI.__inmenu.getWeather = function() {
    return { rain: 0, thunder: 0 };
};
WorldAPI.__inmenu.setWeather = function(weather) {};
WorldAPI.__inmenu.drop = function(x, y, z, id, count, data, extra) {
    return null;
};
WorldAPI.__inmenu.explode = function(x, y, z, power, someBoolean) {};
WorldAPI.__inmenu.setBiomeMap = function(x, z, biome) {};
WorldAPI.__inmenu.getBiomeMap = function(x, z) {
    return -1;
};
WorldAPI.__inmenu.setBiome = function(x, z, biome) {};
WorldAPI.__inmenu.getBiome = function(x, z) {
    return -1;
};
WorldAPI.__inmenu.getBiomeName = function(x, z) {
    return "error: level not loaded";
};
WorldAPI.__inmenu.getBiomeNameById = function(biome) {
    return "error: level not loaded";
};
WorldAPI.__inmenu.getTemperature = function(x, y, z) {
    return 0;
};
WorldAPI.__inmenu.getGrassColor = function(x, z) {
    return 0;
};
WorldAPI.__inmenu.setGrassColor = function(x, z, color) {};
WorldAPI.__inmenu.getGrassColorRGB = function(x, z) {
    return { r: 0, g: 0, b: 0 };
};
WorldAPI.__inmenu.setGrassColorRGB = function(x, z, rgb) {};
WorldAPI.__inmenu.canSeeSky = function(x, y, z) {
    return false;
};
WorldAPI.__inmenu.playSound = function(x, y, z, name, volume, pitch) {};
WorldAPI.__inmenu.playSoundAtEntity = function(entity, name, volume, pitch) {}; */

WorldAPI.setLoaded(false);
Callback.addCallback("LevelSelected", function() {
    WorldAPI.setLoaded(true);
});
Callback.addCallback("LevelLeft", function() {
    WorldAPI.setLoaded(false);
});
Callback.addCallback("BlockChanged", function(coords, block1, block2, int1, int2) {
    WorldAPI.onBlockChanged(coords, block1, block2, int1, int2);
});



var AnimatorToken = {};
AnimatorToken.__current = 1;
AnimatorToken.genToken = function() {
    return this.__current++;
};

function AnimationHelper() {
    this.animation = [];
    this.animationDelay = 1;
    this.animationOffsets = {0: 0};
    this.getOffset = function(token) {
        return this.animationOffsets[token || 0] || 0;
    };
    this.setOffset = function(token, offset) {
        this.animationOffsets[token || 0] = offset;
    };
    this.getGlobalTime = function() {
        return java.lang.System.currentTimeMillis() / 50;
    };
    this.getTime = function(token) {
        return this.getGlobalTime() - this.getOffset(token);
    };
    this.resetAnimation = function(token) {
        this.setOffset(token, this.getGlobalTime());
    };
    this.getFrameNumber = function(token) {
        return parseInt(this.getTime(token) / this.animationDelay) % this.animation.length;
    };
    this.setDelay = function(delay) {
        this.animationDelay = delay || 1;
    };
    this.setAnimation = function(arr) {
        this.animation = arr;
    };
    this.clearAnimation = function() {
        this.animation = [];
    };
    this.addFrame = function(frame) {
        this.animation.push(frame);
    };
    this.getFrame = function(token) {
        return this.animation[this.getFrameNumber(token)];
    };
    this.inherit = function(animator) {
        this.clearAnimation();
        this.setDelay(animator.animationDelay);
        for (var i in animator.animation)
            this.addFrame(animator.animation[i]);
    };
}


function Texture(path) {
    this.path = path;
    this.isAnimated = false;
    this.animator = new AnimationHelper();
    this.resolution = { w: 64, h: 32 };
    this.setTexture = function(path) {
        this.path = path;
        this.isAnimated = false;
        return this;
    };
    this.setResolution = function(w, h) {
        h = h || w;
        this.resolution.w = w;
        this.resolution.h = h;
        return this;
    };
    this.setAnimation = function(animation, delay) {
        this.animator.setDelay(delay);
        this.animator.setAnimation(animation);
        this.isAnimated = true;
        return this;
    };
    this.resetAnimation = function(token) {
        this.animator.resetAnimation(token);
        return this;
    };
    this.getTexture = function(token) {
        if (!this.isAnimated) return this.path;
		else return this.animator.getFrame(token);
    };
    this.getResolution = function() {
        return {
			w: this.resolution.w * this.pixelScale,
			h: this.resolution.h * this.pixelScale
		};
    };
    this.pixelScale = 1;
    this.setPixelScale = function(scale) {
        this.pixelScale = scale;
        return this;
    };
}

var ce_default_entity_texture = new Texture("images/mob/ce_default_entity_texture.png").setPixelScale(8);
var ce_missing_entity_texture = new Texture("images/mob/ce_missing_entity_texture.png").setPixelScale(1);


var EntityRenderGlobalCache = {};
EntityRenderGlobalCache.globalCache = {};
EntityRenderGlobalCache.saveRenderAPI = function(api, name, isLocal) {
    var cache;
    if (isLocal) cache = api.localCache;
    else cache = this.globalCache;
    cache[name] = api.toCache();
};
EntityRenderGlobalCache.loadRenderAPI = function(api, name, isLocal) {
    var cache;
    if (isLocal) cache = api.localCache;
    else cache = this.globalCache;
    if (cache[name]) {
        api.fromCache(cache[name]);
        return true;
    }
    return false;
};


function RenderAPI(params) {
    this.getID = this.getId = this.getRenderType = function() {
        return parseInt(this.renderId);
    };
    this.init = function(params) {
        this.isEmpty = true;
        this.isChangeable = true;
        this.renderer = null;
        this.model = null;
        this.parts = {};
        this.renderId = -1;
        if (!params) params = {};
        if (typeof (params) == "number") {
            this.isChangeable = false;
			this.renderId = params;
            return;
        }
        if (typeof (params) == "string") {
            this.loadInitialState(params);
            return;
        }
        if (typeof (params) != "object") {
            this.isChangeable = false;
            return;
        }
        if (typeof (params.name) == "string") {
            this.loadInitialState(params.name);
            return;
        }
        if (parseInt(params.item)) {
            this.isChangeable = false;
            this.renderer = Renderer.createItemSpriteRenderer(parseInt(params.item));
        } else {
            var skin = params.skin || "textures/logo.png";
            var scale = params.scale || 1;
            this.isEmpty = !params.raw;
            this.isChangeable = true;
            this.renderer = Renderer.createRendererWithSkin(skin, scale);
            this.renderId = this.renderer.getRenderType();
            this.initModel();
        }
    };
    this.initModel = function() {
        this.model = this.renderer.getModel();
        if (this.isEmpty) {
            this.getPart("head").clear();
            this.getPart("body").clear();
            this.getPart("leftArm").clear();
            this.getPart("rightArm").clear();
            this.getPart("leftLeg").clear();
            this.getPart("rightLeg").clear();
        } else {
            this.getPart("head");
            this.getPart("body");
            this.getPart("leftArm");
            this.getPart("rightArm");
            this.getPart("leftLeg");
            this.getPart("rightLeg");
        } 
        this.getPart("headwear").clear(); // backcomp
    };
    this.checkChangeable = function() {
        if (!this.isChangeable) MCSystem.throwException("cannot modify render with id " + this.renderId + " it is not changeable (it is native mob renderer, item sprite or render failed to create).");
    };
    this.rebuild = function() {
        this.model.reset();
    };
    this.getModel = function() {
        this.checkChangeable();
        return this.model;
    };
    this.getPart = function(name) {
        this.checkChangeable();
        var part = this.parts[name];
        if (!part && this.model) {
            part = this.model.getPart(name);
            if (part) this.parts[name] = part;
        }
        return part;
    };
    this.addPart = function(name, params) {
        var dot = name.lastIndexOf(".");
        if (dot == -1) MCSystem.throwException("addPart got invalid part name, it must be formatted as parentPartName.newPartName");
        var parentName = name.substring(0, dot);
        var parentPart = this.getPart(parentName);
        if (!parentPart) MCSystem.throwException("addPart got invalid parent part name " + parentName + ", such part does not exist (full name given is " + name + ")");
        var part = parentPart.addPart(name);
        this.parts[name] = part;
        if (params) this.setPartParams(name, params);
        return part;
    };
    this.setPartParams = function(name, params) {
        var part = this.getPart(name);
        if (!part) MCSystem.throwException("setPart got invalid part name " + name);
        part.setTextureSize(params.width || 64, params.height || 32);
        part.setTextureOffset(params.u || 0, params.v || 0);
        if (params.pos) part.setOffset(params.pos.x || params.pos[0] || 0, params.pos.y
		                                || params.pos[1] || 0, params.pos.z || params.pos[2] || 0);
        if (params.rotation) part.setRotation(params.rotation.x || params.rotation[0] || 0, params.rotation.y
		                                        || params.rotation[1] || 0, params.rotation.z || params.rotation[2] || 0);
    };
    this.setPart = function(name, data, params) {
        var part = this.getPart(name);
        if (!part) MCSystem.throwException("setPart got invalid part name " + name);
        if (params) {
            if (!params.add) part.clear();
            this.setPartParams(name, params);
        }
        this._setPartRecursive(part, data, { x: 0, y: 0, z: 0 });
        this.model.reset();
    };
    this._setPartRecursive = function(part, data, coords) {
        for (var i in data) {
            var element = data[i];
            if (!element.coords) {
                print("RenderAPI Error: some element in part " + part + " has no coords, aborting...");
                Logger.Log("RenderAPI Error: some element in part " + part + " has no coords, aborting...", "ERROR");
                continue;
            }
            var elementCoords = {x: parseFloat(element.coords.x) + parseFloat(coords.x), y: parseFloat(element.coords.y) + parseFloat(coords.y), z: parseFloat(element.coords.z) + parseFloat(coords.z)};
            if (element.uv) part.setTextureOffset(element.uv.x, element.uv.y);
            if (element.size) {
                element.size.w = element.size.w || 0;
                part.addBox(elementCoords.x - element.size.x * 0.5, elementCoords.y - element.size.y * 0.5, elementCoords.z - element.size.z * 0.5, element.size.x, element.size.y, element.size.z, element.size.w);
            }
            if (element.children) this._setPartRecursive(part, elementCoords, element.children);
        }
    };
    this.localCache = {};
    this.fromCache = function(data) {
        this.renderer = data.renderer;
        this.renderId = data.renderId;
        this.model = data.model;
        this.isChangeable = data.isChangeable;
        this.parts = data.parts;
    };
    this.toCache = function() {
        return {
			renderer: this.renderer,
			renderId: this.renderId,
			model: this.model,
			parts: this.parts,
			isChangeable: this.isChangeable
		};
    };
    this.saveState = function(name, isLocal) {
        EntityRenderGlobalCache.saveRenderAPI(this, name, isLocal);
    };
    this.loadState = function(name, isLocal) {
        return EntityRenderGlobalCache.loadRenderAPI(this, name, isLocal);
    };
    this.loadInitialState = function(name) {
        if (!this.loadState(name)) MCSystem.throwException("cannot create Render object from saved state " + name + ", it does not exist");
    };
    this.saveToNext = function(name, isLocal) {
        this.saveState(name), this.init(params);
    };
    this.init(params);
    this.setTextureResolution = function() {
        logDeprecation("RenderAPI.setTextureResolution");
    };
    this.transform = function() {
        if (!this.renderer) MCSystem.throwException("cannot apply transformations for native renders or renders that weren't created properly");
        return this.renderer.transform;
    };
}

var BASIC_NULL_RENDER = new RenderAPI();
var ce_default_entity_render = new RenderAPI();
ce_default_entity_render.setPart("body", [{
	type: "box", coords: { x: 0, y: 16, z: 0 },
	uv: { x: 0, y: 0 }, size: { x: 16, y: 16, z: 16 }}], {});


function ModelAPI(parentModel) {
    this.applyTextureResolution = function() {
        var resolution = this.getTextureResolution();
        if (this.render) this.render.setTextureResolution(resolution.w, resolution.h);
        for (var i in this.animator.animation)
            this.animator.animation[i].setTextureResolution(resolution.w, resolution.h);
        return this;
    };
    this.setTexture = function(textureObj) {
        this.texture = textureObj || ce_missing_entity_texture;
		this.applyTextureResolution();
        return this;
    };
    this.getTextureObj = function() {
        return this.texture;
    };
    this.getTexture = function() {
        return this.texture.getTexture();
    };
    this.getTextureResolution = function() {
        return this.texture.getResolution();
    };
    this.isAnimated = false;
    this.animator = new AnimationHelper();
    this.setRender = function(render) {
        this.isAnimated = false;
        this.render = render || ce_default_entity_render;
        return this;
    };
    this.createAnimation = function(ticks, func, delay) {
        this.animator.clearAnimation();
        this.animator.setDelay(delay);
        var last = this.render;
        for (var tick = 0; tick < ticks; tick++) {
            var render = func(tick, this);
            if (render) {
                this.animator.addFrame(render);
                last = render;
            } else this.animator.addFrame(last);
        }
		this.applyTextureResolution();
        this.isAnimated = true;
        return this;
    };
    this.resetAnimation = function(token) {
        this.texture.resetAnimation(token);
        this.animator.resetAnimation(token);
    };
    this.getTextureAndRender = function(token) {
        var texture = this.texture.getTexture(token);
        var render;
        if (!this.isAnimated) render = this.render;
		else render = this.animator.getFrame(token);
        return { texture: texture, render: render.getID() };
    };
    if (parentModel) {
        this.setTexture(parentModel.texture);
        this.setRender(parentModel.render);
        this.animator.inherit(parentModel.animator);
        this.isAnimated = parentModel.isAnimated;
    } else {
        this.setTexture(null);
        this.setRender(null);
    }
}

var ce_default_entity_model = new ModelAPI().setTexture(ce_default_entity_texture);
var ce_empty_entity_model = new ModelAPI().setRender(BASIC_NULL_RENDER);
var ce_missing_entity_model = new ModelAPI();


function ModelWatcher(entity, model) {
    this._texture = null;
    this._render = null;
    this.model = model;
    this.entity = entity;
    this.token = AnimatorToken.genToken();
    this.update = function() {
        var current = this.model.getTextureAndRender(this.token);
        if (current.texture != this._texture) {
            this._texture = current.texture;
            EntityAPI.setSkin(this.entity, this._texture);
        }
        if (current.render != this._render) {
            this._render = current.render;
            EntityAPI.setRender(this.entity, this._render);
        }
    };
    this.resetAnimation = function() {
        this.model.resetAnimation(this.token);
    };
    this.destroy = function() {
        this.remove = true;
    };
}



function EntityAI(customPrototype) {
    this.getDefaultPriority = function() {
        return 1;
    };
    this.getDefaultName = function() {
        return "basic-entity-ai";
    };
    this.params = {};
    this.setParams = function(params) {
        for (var name in params)
            this.params[name] = params[name];
    };
    this.executionStarted = function() {};
    this.executionEnded = function() {};
    this.executionPaused = function() {};
    this.executionResumed = function() {};
    this.execute = function() {};
    this.__execute = function() {
        if (this.data.executionTimer > 0) {
            this.data.executionTimer--;
            if (this.data.executionTimer == 0) {
                this.finishExecution();
                return;
            }
        }
        this.execute();
    };
    this.setExecutionTimer = function(timer) {
        this.data.executionTimer = timer;
    };
    this.removeExecutionTimer = function() {
        this.data.executionTimer = -1;
    };
    this.data = { executionTimer: -1 };
    this.isInstance = false;
    this.parent = null;
    this.entity = null;
    this.instantiate = function(parent, name) {
        var instance = ModAPI.cloneObject(this, true);
        instance.parent = parent;
        instance.entity = parent.entity;
        instance.controller = parent.AI;
        instance.isInstance = true;
        instance.executionName = name;
        return instance;
    };
    this.aiEntityChanged = function(entity) {
        this.entity = entity;
    };
    this.finishExecution = function() {
        if (this.controller) this.controller.disableAI(this.executionName);
    };
    this.changeSelfPriority = function(priority) {
        if (this.controller) this.controller.setPriority(this.executionName, priority);
    };
    this.enableAI = function(name, priority, extra) {
        if (this.controller) this.controller.setPriority(name, priority, extra);
    };
    this.disableAI = function(name) {
        if (this.controller) this.controller.setPriority(name);
    };
    this.setPriority = function(name, priority) {
        if (this.controller) this.controller.setPriority(name, priority);
    };
    this.getAI = function(name) {
        if (this.controller) return this.controller.getAI(name);
    };
    this.getPriority = function(name) {
        if (this.controller) return this.controller.getPriority(name);
    };
    this.attackedBy = function(entity) {};
    this.hurtBy = function(entity) {};
    this.projectileHit = function(projectile) {};
    this.death = function(entity) {};
    for (var name in customPrototype) {
        this[name] = customPrototype[name];
    }
}

var EntityAIIdle = new EntityAI({
	getDefaultPrioriy: function() {
		return 1;
	},
	getDefaultName: function() {
		return "idle";
	}
});

function __normalizeAngle(x) {
    while (x > Math.PI * 2) {
        x -= Math.PI * 2;
    }
    while (x < 0) {
        x += Math.PI * 2;
    }
    return x;
}

function __targetValue(x, val, speed) {
    return x + Math.min(Math.max(-speed, val - x), speed);
}

function __targetAngle(angle, target, speed) {
    angle = __normalizeAngle(angle);
    target = __normalizeAngle(target);
    if (target - Math.PI > angle)
        target -= Math.PI * 2;
    if (angle - Math.PI > target)
        target += Math.PI * 2;
    return __targetValue(angle, target, speed);
}

var EntityAIFollow = new EntityAI({
	data: {
		target: null,
		targetEntity: null,
		movingYaw: 0
	},
	params: {
		speed: 0.2,
		jumpVel: 0.45,
		rotateSpeed: 0.4,
		rotateRatio: 0.5,
		rotateHead: true,
		denyY: true
	},
	setParams: function(params) {
		for (var name in params) {
			this.params[name] = params[name];
		}
	},
	execute: function() {
		if (this.data.targetEntity) this.data.target = EntityAPI.getPosition(this.data.targetEntity);
		if (this.data.target) {
            var movingVec = EntityAPI.getMovingVector(this.entity);
            var movingAngle = EntityAPI.getMovingAngle(this.entity).yaw;
            var targetAngle = EntityAPI.getLookAt(this.entity, this.data.target.x, this.data.target.y, this.data.target.z).yaw;
            var deltaAngle = movingAngle - targetAngle;
            if (!this.data.movingYaw) this.data.movingYaw = targetAngle;
            if (movingVec.xzsize < this.params.speed * 0.5)
                this.data.movingYaw = __targetAngle(this.data.movingYaw, targetAngle + deltaAngle * 1.2, this.params.rotateSpeed);
            this.data.movingYaw = __targetAngle(this.data.movingYaw, targetAngle, this.params.rotateSpeed * this.params.rotateRatio);
            EntityAPI.moveToAngle(this.entity, {yaw: this.data.movingYaw, pitch: 0}, this.params);
            if (this.params.rotateHead) EntityAPI.setLookAngle(this.entity, this.data.movingYaw, targetAngle.pitch);
        }
    }
});

var EntityAIPanic = new EntityAI({
	getDefaultPriority: function() {
		return 3;
	},
	getDefaultName: function() {
		return "panic";
	},
	params: {
		speed: 0.22,
		angular_speed: 0.5
	},
	data: {
		yaw: 0,
		add: 0
	},
	setParams: function(params) {
        for (var name in params)
            this.params[name] = params[name];
    },
	randomize: function() {
		if (Math.random() >= 0.5) this.data.add = 0;
		else this.data.add = (Math.random() * -0.5) * this.params.angular_speed;
	},
	executionStarted: function() {
		this.data.yaw = Math.random() * Math.PI * 2;
		this.randomize();
	},
	execute: function() {
		if (WorldAPI.getThreadTime() % 30 == 0) {
			this.randomize();
			EntityAPI.setLookAngle(this.entity, this.data.yaw, 0);
		}
		this.data.yaw += this.data.add;
		EntityAPI.moveToLook(this.entity, {
			speed: this.params.speed,
			denyY: true,
			jumpVel: 0.45
		});
	}
});

var EntityAIWander = new EntityAI({
	getDefaultPriority: function() {
		return 2;
	},
	getDefaultName: function() {
		return "wander";
	},
	params: {
		speed: 0.08,
		angular_speed: 0.1,
		delay_weight: 0.3
	},
	data: {
		yaw: 0,
		add: 0,
		delay: false,
		_delay: true
	},
	setParams: function(params) {
		for (var name in params) this.params[name] = params[name];
	},
	randomize: function() {
		if (Math.random() < this.params.delay_weight) this.data.delay = true;
		else {
			this.data.delay = false;
			if (Math.random() >= 0.5) this.data.add = 0;
            else this.data.add = (Math.random() * -0.5) * this.params.angular_speed;
	    }
	},
	executionStarted: function() {
		this.data.yaw = Math.random() * Math.PI * 2;
		this.randomize();
	},
	execute: function() {
		if (WorldAPI.getThreadTime() % 30 == 0) {
			this.randomize();
			EntityAPI.setLookAngle(this.entity, this.data.yaw, 0);
		}
		if (!this.data.delay) {
			this.data.yaw += this.data.add;
			EntityAPI.moveToLook(this.entity, {
				speed: this.params.speed,
				denyY: true,
				jumpVel: this.data._delay ? 0 : 0.45
			});
		}
		this.data._delay = this.data.delay;
	}
});

var EntityAIAttack = new EntityAI({
	params: {
		attack_damage: 5,
		attack_range: 2.5,
		attack_rate: 12
	},
	data: {
		timer: 0,
		target: null
	},
	execute: function() {
		if (this.data.target) {
			if (EntityAPI.getDistanceToEntity(this.entity, this.data.target) < this.params.attack_range) {
				if (this.data.timer-- < 0) {
					this.data.timer = this.params.attack_rate;
					EntityAPI.damageEntity(this.data.target, this.params.attack_damage);
				}
			} else this.data.timer = 0;
		}
	}
});

var EntityAISwim = new EntityAI({
	getDefaultPriority: function() {
		return -1;
	},
	getDefaultName: function() {
		return "swim";
	},
	params: {
		velocity: 0.2
	},
	inWater: false,
	execute: function() {
		if (WorldAPI.getThreadTime() % 5 == 0) {
			var position = EntityAPI.getPosition(this.entity);
			var tile = WorldAPI.getBlockID(position.x, position.y + 0.4, position.z);
			this.inWater = (tile > 7 && tile < 12);
		}
		if (this.inWater) {
			var velocity = EntityAPI.getVelocity(this.entity);
			EntityAPI.setVelocity(this.entity, velocity.x, this.params.velocity, velocity.z);
		}
	}
});

function EntityAIWatcher(customPrototype) {
    this.parent = EntityAI;
    this.parent(customPrototype);
    this.getDefaultPriority = function() {
        return -1;
    };
    this.__execute = function() {
        this.execute();
    };
}

var EntityAIPanicWatcher = new EntityAIWatcher({
	params: {
		panic_time: 200,
		priority_panic: 5,
		priority_default: 1,
		name: "panic"
	},
	data: {
		timer: -1
	},
	hurtBy: function() {
		this.setPriority(this.params.name, this.params.priority_panic);
		this.data.timer = this.params.panic_time;
	},
	executionStarted: function() {
		this.setPriority(this.params.name, this.params.priority_default);
	},
	execute: function() {
		if (this.data.timer >= 0)
			if (--this.data.timer == 0)
				this.setPriority(this.params.name, this.params.priority_default);
	}
});



var EntityAIController = {};
EntityAIController.currentPriority = 0;
EntityAIController.loadedAI = {};
EntityAIController.loadedData = {};
EntityAIController.isAILoaded = false;
EntityAIController.getAITypes = function() {
    return {
		"main": {
			type: EntityAIIdle
		}
	};
};
EntityAIController.loadEntityAI = function() {
    var types = this.getAITypes();
    this.loadedAI = {};
    for (var name in types) {
        var data = types[name];
        var AI = data.type.instantiate(this.parent, name);
        AI.setParams(data);
        var enabled = data.enable + "" == "undefined" ? true : data.enable;
        this.loadedAI[name] = {
			AI: AI,
			priority: data.priority || AI.getDefaultPriority(),
			enabled: enabled
		};
        if (enabled) AI.executionStarted();
    }
    for (var name in this.loadedData) {
        var data = this.loadedData[name];
        var ai = this.loadedAI[name];
        if (ai) {
            ai.priority = data.p;
            ai.enabled = data.e;
            ai.data = data.d || {};
        }
    }
    this.refreshPriorities();
};

EntityAIController.loaded = function() {
    if (!this.isAILoaded) {
        this.loadEntityAI();
        this.aiLoaded();
        this.isAILoaded = true;
    } else this.callAIevent("executionResumed");
};
EntityAIController.nativeEntityChanged = function() {
    this.callAIevent("aiEntityChanged", this.parent.entity);
};
EntityAIController.unloaded = function() {
    this.callAIevent("executionPaused");
};
EntityAIController.aiLoaded = function() {};

EntityAIController.getAI = function(name) {
    return this.loadedAI[name].AI;
};
EntityAIController.getPriority = function(name) {
    return this.loadedAI[name].priority;
};
EntityAIController.enableAI = function(name, priority, extra) {
    var data = this.loadedAI[name];
    if (data) {
        if (!data.enabled) {
            data.enabled = true;
            data.AI.executionStarted(extra);
        }
        this.setPriority(name, priority + "" == "undefined" ? data.priority : priority);
    }
};
EntityAIController.disableAI = function(name) {
    var data = this.loadedAI[name];
    if (data && data.enabled) {
        data.enabled = false;
        data.AI.executionEnded();
        this.refreshPriorities();
    }
};
EntityAIController.setPriority = function(name, priority) {
    var data = this.loadedAI[name];
    if (data && data.priority != priority) {
        var isActive = data.priority == this.currentPriority;
        data.priority = priority;
        this.refreshPriorities();
        if (isActive && data.priority != this.currentPriority)
            data.AI.executionPaused();
    }
};
EntityAIController.refreshPriorities = function() {
    var maxPriority = -1;
    for (var name in this.loadedAI) {
        var data = this.loadedAI[name];
        if (data.enabled && maxPriority < data.priority) {
            maxPriority = data.priority;
        }
    }
    if (maxPriority != this.currentPriority) {
        for (var name in this.loadedAI) {
            var data = this.loadedAI[name];
            if (data.enabled) {
                if (data.priority == maxPriority) data.AI.executionResumed();
                if (data.priority == this.currentPriority) data.AI.executionPaused();
            }
        }
    }
    this.currentPriority = maxPriority;
};

EntityAIController.callAIevent = function(eventName, parameter, extra) {
    for (var name in this.loadedAI) {
        var data = this.loadedAI[name];
        if (data.enabled) data.AI[eventName](parameter, extra);
    }
};
EntityAIController.update = function() {
    for (var name in this.loadedAI) {
        var data = this.loadedAI[name];
        if (data.enabled && (data.priority == this.currentPriority || data.priority == -1)) {
            data.AI.__execute();
        }
    }
    this.tick();
};
EntityAIController.save = function() {
    var data = {};
    for (var name in this.loadedAI) {
        var ai = this.loadedAI[name];
        data[name] = {
			e: ai.enabled,
			p: ai.priority,
			d: ai.AI.data
		};
    }
    return data;
};
EntityAIController.read = function(data) {
    this.loadedData = data;
};

EntityAIController.tick = function() {};
EntityAIController.attackedBy = function(attacker) {
    this.callAIevent("attackedBy", attacker);
};
EntityAIController.hurtBy = function(attacker, damage) {
    this.callAIevent("hurtBy", attacker, damage);
};
EntityAIController.death = function(attacker) {
    this.callAIevent("death", attacker);
};
EntityAIController.projectileHit = function(projectile) {
    this.callAIevent("projectileHit", projectile);
};


var EntityDescriptionController = {};
EntityDescriptionController.isDynamic = false;
EntityDescriptionController.getHitbox = function() {
    return { w: 0.99, h: 0.99 };
};
EntityDescriptionController.getHealth = function() {
    return 20;
};
EntityDescriptionController.getNameTag = function() {
    return null;
};
EntityDescriptionController.getDrop = function(attacker) {
    return [];
};
EntityDescriptionController.update = function() {};
EntityDescriptionController.save = function() {};
EntityDescriptionController.read = function() {};

EntityDescriptionController.created = function() {
    var health = this.getHealth();
    Entity.setMaxHealth(this.entity, health);
    Entity.setHealth(this.entity, health);
};
EntityDescriptionController.loaded = function() {
    var health = this.getHealth();
    Entity.setMaxHealth(this.entity, health);
    var hitbox = this.getHitbox();
    Entity.setCollisionSize(this.entity, hitbox.w || 0, hitbox.h || 0);
    var nametag = this.getNameTag();
    if (nametag) Entity.setNameTag(this.entity, nametag);
    else Entity.setNameTag(this.entity, "");
};
EntityDescriptionController.unloaded = function() {};
EntityDescriptionController.removed = function() {};

EntityDescriptionController.getNumberFromData = function(data, defValue) {
    if (!data) return defValue;
    if (typeof (data) == "number") return data;
    else {
        if (data.min && data.max)
            return parseInt((data.max - data.min + 1) * Math.random()) + data.min;
        else if (!data.length) return defValue;
		else return data[parseInt(data.length * Math.random())];
    }
};
EntityDescriptionController.provideDrop = function(attacker) {
    var drop = this.getDrop(attacker);
    var pos = EntityAPI.getPosition(this.entity);
    var dropItem = function(id, count, data, extra) {
        EntityAPI.setVelocity(Level.dropItem(pos.x, pos.y + 0.3, pos.z, 0, id, count, data, extra),
		                        Math.random() * 0.4 - 0.2, Math.random() * 0.3, Math.random() * 0.4 - 0.2);
    };
    for (var i in drop) {
        var item = drop[i];
        var chance = item.chance || 1;
        if (item.id && Math.random() < chance) {
            var count = this.getNumberFromData(item.count, 1);
            var data = this.getNumberFromData(item.data, 0);
            if (item.separate) {
                for (var j = 0; j < count; j++)
                    dropItem(item.id, 1, data);
            } else dropItem(item.id, count, data, item.extra);
        }
    }
};
EntityDescriptionController.death = function(attacker) {
    this.provideDrop(attacker);
};


var EntityVisualController = {};
EntityVisualController.modelWatchers = {};
EntityVisualController.modelWatcherStack = [];

EntityVisualController.getModels = function() {
    return {
		"main": ce_default_entity_model
	};
};
EntityVisualController.createModelWatchers = function() {
    this.modelWatchers = {};
    var models = this.getModels();
    if (!models.main) models.main = ce_default_entity_model;
    for (var name in models)
        this.modelWatchers[name] = new ModelWatcher(this.entity, models[name]);
};
EntityVisualController.getModelWatcher = function(name) {
    return this.modelWatchers[name];
};
EntityVisualController.setModel = function(name, ticks) {
    var watcher = this.getModelWatcher(name);
    if (!watcher) {
        Logger.Log("cannot set entity model: no model watcher for '" + name + "' found.", "ERROR");
        return;
    }
    if (!this.modelWatcherStack) this.modelWatcherStack = [];
    if (ticks < 0) this.modelWatcherStack = [{ name: name, ticks: -1 }];
	else this.modelWatcherStack.unshift({ name: name, ticks: ticks });
    watcher.resetAnimation();
};
EntityVisualController.resetModel = function() {
    this.modelWatcherStack = [];
};
EntityVisualController.resetAllAnimations = function() {
    for (var name in this.modelWatchers)
        this.modelWatchers[name].resetAnimation();
};
EntityVisualController.getCurrentModelName = function() {
    var current = this.modelWatcherStack[0];
    while (current && current.ticks == 0)
        current = this.modelWatcherStack.shift();
    return current || { name: "main", ticks: -1 };
};

EntityVisualController.loaded = function() {
    this.createModelWatchers();
};
EntityVisualController.update = function() {
    var current = this.getCurrentModelName();
    var watcher = this.getModelWatcher(current.name);
    if (watcher) watcher.update();
    current.ticks--;
};
EntityVisualController.save = function() {
    return this.modelWatcherStack;
};
EntityVisualController.read = function(data) {
    this.modelWatcherStack = data || [];
};


var EntityEventController = {};
EntityEventController.update = function() {
    this.tick();
};
EntityEventController.save = function() {};
EntityEventController.read = function() {};
EntityEventController.tick = function() {};
EntityEventController.removed = function() {};
EntityEventController.created = function(extra) {};
EntityEventController.loaded = function() {};
EntityEventController.unloaded = function() {};
EntityEventController.attackedBy = function(attacker) {};
EntityEventController.hurtBy = function(attacker, damage) {};
EntityEventController.death = function(attacker) {};
EntityEventController.projectileHit = function(projectile) {};



var CustomEntityConfig = {};
CustomEntityConfig.unloaded_despawn_time_in_secs = 600;
CustomEntityConfig.despawn_unloaded_entities =true;

var ENTITY_UNLOAD_DISTANCE = 56;

function CustomEntity(nameId) {
    this.nameId = nameId;
    this.controllers = {};
    this.isInstance = false;
    this.entity = null;
    this.age = 0;
    this.unloadedTime = 0;
    this.realPosition = null;
    this.__base_type = 28;
    var self = this;
    this.saverId = Saver.registerObjectSaver(this.nameId, {
		read: function(obj) {
			self.read(obj);
			return null;
		},
		save: function(obj) {
			return obj.save();
		}
	});
    this.addController = function(name, basicPrototype) {
        var controller = ModAPI.cloneObject(basicPrototype, true);
        controller.parent = null;
        controller.__controller_name = name;
        this[name] = controller;
        this.controllers[name] = controller;
        return this;
    };
    this.customizeController = function(name, customPrototype) {
        if (!this[name]) {
            Logger.Log("Cannot customize entity controller " + name + ": no such defined", "ERROR");
            return;
        }
        var customController = ModAPI.cloneObject(customPrototype, true);
        var baseController = this[name];
        for (var name in customController)
            baseController[name] = customController[name];
    };
    this.customizeEvents = function(custom) {
        this.customizeController("event", custom);
    };
    this.customizeDescription = function(custom) {
        this.customizeController("description", custom);
    };
    this.customizeVisual = function(custom) {
        this.customizeController("visual", custom);
    };
    this.customizeAI = function(custom) {
        this.customizeController("AI", custom);
    };
    this.setBaseType = function(type) {
        if (this.isInstance) {
            Logger.Log("cannot set base entity type on entity in world", "ERROR");
            return;
        }
        this.__base_type = type;
    };
    this.callControllerEvent = function() {
        var event = arguments[0];
        var params = [];
        for (var i in arguments)
            if (i > 0) params.push(arguments[i]);
        for (var name in this.controllers) {
            var controller = this.controllers[name];
            if (controller[event]) controller[event].apply(controller, params);
        }
    };
    this.setNativeEntity = function(entity) {
        this.entity = parseInt(entity);
        for (var name in this.controllers) {
            var controller = this.controllers[name];
            controller.entity = parseInt(entity);
        }
        this.callControllerEvent("nativeEntityChanged");
    };
    this.recreateEntity = function() {
        if (this.realPosition) {
            this.lockRemovalHook = true;
            Entity.remove(this.entity);
            this.lockRemovalHook = false;
            this.setNativeEntity(Level.spawnMob(this.realPosition.x, this.realPosition.y, this.realPosition.z, this.__base_type));
            if (!this.isLoaded) {
                this.isLoaded = true;
                this.callControllerEvent("loaded");
            }
        }
    };
    this.getPlayerDistance = function() {
        var dx = getPlayerX() - this.realPosition.x;
        var dz = getPlayerZ() - this.realPosition.z;
        return Math.sqrt(dx * dx + dz * dz);
    };
    this.denyDespawn = function() {
        this.isNaturalDespawnAllowed = false;
        this.isDespawnDenied = true;
    };
    this.allowNaturalDespawn = function() {
        this.isNaturalDespawnAllowed = true;
        this.isDespawnDenied = false;
    };
    this.handleUnloadedState = function() {
        this.unloadedTime++;
        if (this.age % 200 == 0) {
            if (!this.isDespawnDenied && CustomEntityConfig.despawn_unloaded_entities && this.unloadedTime > CustomEntityConfig.unloaded_despawn_time_in_secs) {
                this.destroy();
            } else {
                if (this.getPlayerDistance() < ENTITY_UNLOAD_DISTANCE) {
                    if (!this.isNaturalDespawnAllowed) {
                        if (!this.isDestroyed) this.recreateEntity();
                    } else this.destroy();
                }
            }
        }
    };
    this.update = function() {
        if (this.age % 20 == 0) {
            var position = EntityAPI.getPosition(this.entity);
            var isLoaded = position.y > 0;
            if (isLoaded) this.realPosition = position;
            if (this.isLoaded && !isLoaded)
                this.callControllerEvent("unloaded");
            if (!this.isLoaded && isLoaded)
                this.callControllerEvent("loaded");
            this.isLoaded = isLoaded;
            if (isLoaded) this.unloadedTime = 0;
            else this.handleUnloadedState();
        }
        if (this.isLoaded)
            for (var name in this.controllers) 
                this.controllers[name].update();
        this.age++;
    };
    this.instantiate = function(entity) {
        entity = parseInt(entity);
        var instance = ModAPI.cloneObject(this, true);
        instance.entity = entity;
        instance.realPosition = EntityAPI.getPosition(entity);
        instance.isInstance = true;
        instance.isLoaded = false;
        for (var name in instance.controllers) {
            var controller = instance.controllers[name];
            controller.parent = instance;
            controller.entity = entity;
            instance[name] = controller;
        }
        Saver.registerObject(instance, this.saverId);
        MobRegistry.registerUpdatableAsEntity(instance);
        Updatable.addUpdatable(instance);
        return instance;
    };
    this.lockRemovalHook = false;
    this.registerRemoval = function() {
        if (this.lockRemovalHook) return;
        this.isLoaded = false;
        if (EntityAPI.getXZPlayerDis(this.entity) > ENTITY_UNLOAD_DISTANCE)
            this.callControllerEvent("unloaded");
        else this.destroy();
    };
    this.destroy = function() {
        this.remove = this.isDestroyed = true;
        this.callControllerEvent("removed");
        Entity.remove(this.entity);
        this.callControllerEvent("unloaded");
    };
    this.read = function(data) {
        var instance;
        if (this.isInstance) instance = this;
		else instance = this.instantiate(data.entity);
        instance.entity = data.entity || null;
        instance.age = data.age || 0;
        instance.unloadedTime = data.unloaded || 0;
        instance.realPosition = data.rp || null;
        for (var name in data.controllers) {
            var controller = instance[name];
            if (controller) {
                controller.read(data.controllers[name]);
                controller.entity = instance.entity;
            } else Logger.Log("Entity controller is missing " + name + " while reading entity data", "WARNING");
        }
    };
    this.save = function() {
        var data = {
			entity: parseInt(this.entity),
			age: this.age,
			oneAndHalf: 1.5,
			unloaded: this.unloadedTime,
			controllers: {}, 
			rp: this.realPosition
		};
        for (var name in this.controllers)
            data.controllers[name] = this.controllers[name].save(name);
        return data;
    };
}

// TODO: why it isn't availabled?
// Callback.addCallback("CoreConfigured", function(config) {
    // CustomEntityConfig = config.access("perfomance.entity");
// });


var MobRegistry = {};
MobRegistry.customEntities = {};
MobRegistry.loadedEntities = [];
MobRegistry.registerEntity = function(name) {
    var customEntityType = new CustomEntity(name);
    customEntityType.addController("event", EntityEventController);
    customEntityType.addController("description", EntityDescriptionController);
    customEntityType.addController("visual", EntityVisualController);
    customEntityType.addController("AI", EntityAIController);
    this.customEntities[name] = customEntityType;
    return customEntityType;
};
MobRegistry.registerUpdatableAsEntity = function(updatable) {
    for (var i in this.loadedEntities) {
        if (this.loadedEntities[i].entity == updatable.entity) {
            Logger.Log("Dublicate entities updatables loaded for " + updatable.entity + ", removing second one", "WARNING");
            updatable.remove = true;
            return;
        }
    }
    this.loadedEntities.push(updatable);
};
MobRegistry.spawnEntityAsPrototype = function(typeName, coords, extraData) {
    var customEntityType = this.customEntities[typeName];
    if (!customEntityType) Logger.Log("Cannot spawn custom entity: type " + typeName + "is not found", "ERROR");
    var entity = Level.spawnMob(coords.x, coords.y, coords.z, customEntityType.__base_type);
    var customEntity = customEntityType.instantiate(entity);
    customEntity.callControllerEvent("created", extraData);
    customEntity.update();
    return customEntity;
};
MobRegistry.getEntityUpdatable = function(entity) {
    entity = parseInt(entity);
    for (var i in this.loadedEntities)
        if (this.loadedEntities[i].entity == entity)
            return this.loadedEntities[i];
    return null;
};
MobRegistry.registerNativeEntity = function(entity) {
	// TODO: make this function useful
};
MobRegistry.registerEntityRemove = function(entity) {
    var updatable = this.getEntityUpdatable(entity);
    if (updatable) updatable.registerRemoval();
};
MobRegistry.resetEngine = function() {
    this.loadedEntities = [];
};

Callback.addCallback("LevelSelected", function() {
    MobRegistry.resetEngine();
});
Callback.addCallback("EntityAdded", function(entity) {
    MobRegistry.registerNativeEntity(entity);
});
Callback.addCallback("EntityRemoved", function(entity) {
    MobRegistry.registerEntityRemove(entity);
});
Callback.addCallback("PlayerAttack", function(attacker, victim) {
    var updatable = MobRegistry.getEntityUpdatable(victim);
    if (updatable) updatable.callControllerEvent("attackedBy", attacker);
});
Callback.addCallback("EntityDeath", function(entity, attacker) {
    var updatable = MobRegistry.getEntityUpdatable(entity);
    if (updatable) updatable.callControllerEvent("death", attacker);
});
Callback.addCallback("EntityHurt", function(attacker, victim, damage) {
    var updatable = MobRegistry.getEntityUpdatable(victim);
    if (updatable) updatable.callControllerEvent("hurtBy", attacker, damage);
});
Callback.addCallback("ProjectileHitEntity", function(projectile, entity) {
    var updatable = MobRegistry.getEntityUpdatable(entity);
    if (updatable) updatable.callControllerEvent("projectileHit", projectile);
});


var ENTITY_MIN_SPAWN_DIS = 32;
var ENTITY_MAX_SPAWN_DIS = 63;

var EntitySpawnRegistry = {};
EntitySpawnRegistry.spawnData = [];
EntitySpawnRegistry.registerSpawn = function(entityType, rarity, condition, denyNaturalDespawn) {
    if (!condition)
        condition = function() {
            return parseInt(Math.random() * 3 + 1);
        };
    this.spawnData.push({
		type: entityType,
		rarity: rarity,
		condition: condition,
		denyNaturalDespawn: denyNaturalDespawn
	});
};
EntitySpawnRegistry.getRandomSpawn = function(rarityMultiplier) {
    var spawn = this.spawnData[parseInt(Math.random() * this.spawnData.length)];
    if (spawn) {
        var chance = spawn.rarity * this.spawnData.length * rarityMultiplier;
        if (Math.random() < chance) return spawn;
    }
};
EntitySpawnRegistry.getRandPosition = function() {
    var angle = Math.random() * Math.PI * 2;
    var dist = Math.random() * (ENTITY_MAX_SPAWN_DIS - ENTITY_MIN_SPAWN_DIS) + ENTITY_MIN_SPAWN_DIS;
    return { x: getPlayerX() + Math.sin(angle) * dist, z: getPlayerZ() + Math.cos(angle) * dist };
};
EntitySpawnRegistry.executeSpawn = function(spawn, position) {
    position = position || this.getRandPosition();
    var api = {
		y: -1,
		accessY: function() {
			if (this.y == -1) this.y = WorldGenerationUtils.findLowSurface(position.x, position.z).y + 1;
			return this.y;
		},
		condition: spawn.condition
	};
    var count = api.condition(position.x, position.z);
    if (count > 0) {
        position.y = api.accessY();
        for (var i = 0; i < count; i++) {
            var entity = EntityAPI.spawnCustomAtCoords(spawn.type, position);
            entity.allowNaturalDespawn(!spawn.denyNaturalDespawn);
            EntityAPI.setVelocity(entity.entity, Math.random() - 0.5, 0, Math.random() - 0.5);
        }
    }
};

EntitySpawnRegistry.counter = 0;
EntitySpawnRegistry.tick = function() {
    if (this.counter++ % 100 == 0) {
        var spawn = this.getRandomSpawn(5 / 60);
        if (spawn) this.executeSpawn(spawn);
    }
};
EntitySpawnRegistry.onChunkGenerated = function(x, z) {
    for (var i = 0; i < this.spawnData.length; i++) {
        var position = {
			x: (x + Math.random()) * 16,
			z: (z + Math.random()) * 16
		};
        var spawn = this.getRandomSpawn(2 / this.spawnData.length);
        if (spawn) this.executeSpawn(spawn, position);
    }
};

Callback.addCallback("tick", function() {
    EntitySpawnRegistry.tick();
});
Callback.addCallback("GenerateChunk", function(x, z) {
    EntitySpawnRegistry.onChunkGenerated(x, z);
});



var PlayerAPI = {};
PlayerAPI.get = function() {
    return getPlayerEnt();
};
PlayerAPI.getNameForEnt = function(ent) {
    return Player.getName(ent);
};
PlayerAPI.getName = function() {
    return this.getNameForEnt(this.get());
};
PlayerAPI.getDimension = function() {
    return Player.getDimension();
};
PlayerAPI.isPlayer = function(ent) {
    return Player.isPlayer(ent);
};
PlayerAPI.getPointed = function() {
    var pointedData = Player.getPointed();
    var pos = pointedData.pos;
    pointedData.block = WorldAPI.getBlock(pos.x, pos.y, pos.side);
    return pointedData;
};

PlayerAPI.getInventory = function(loadPart, handleEnchant, handleNames) {
    logDeprecation("Player.getInventory");
	return null;
};
PlayerAPI.addItemToInventory = function(id, count, data, extra, preventDrop) {
    Player.addItemInventory(id, count, data, preventDrop, extra);
};
PlayerAPI.getCarriedItem = function(handleEnchant, handleNames) {
    return Player.getCarriedItem();
};
PlayerAPI.setCarriedItem = function(id, count, data, extra) {
    return Player.setCarriedItem(id, count, data, extra);
};
PlayerAPI.getOffhandItem = function() {
    return Player.getOffhandItem();
};
PlayerAPI.setOffhandItem = function(id, count, data, extra) {
    return Player.setOffhandItem(id, count, data, extra);
};
PlayerAPI.decreaseCarriedItem = function(count) {
    if (count + "" == "undefined") count = 1;
    var carried = this.getCarriedItem(true, true);
    this.setCarriedItem(carried.id, carried.count - count, carried.data, carried.enchant, carried.name);
};
PlayerAPI.getInventorySlot = function(slot) {
    return Player.getInventorySlot(slot);
};
PlayerAPI.setInventorySlot = function(slot, id, count, data, extra) {
    return Player.setInventorySlot(slot, id, count, data, extra);
};
PlayerAPI.getArmorSlot = function(slot) {
    return Player.getArmorSlot(slot);
};
PlayerAPI.setArmorSlot = function(slot, id, count, data, extra) {
    return Player.setArmorSlot(slot, id, count, data, extra);
};
PlayerAPI.getSelectedSlotId = function() {
    return Player.getSelectedSlotId();
};
PlayerAPI.setSelectedSlotId = function(slot) {
    return Player.setSelectedSlotId(slot);
};

PlayerAPI.setPosition = function(x, y, z) {
    Entity.setPosition(getPlayerEnt(), x, y, z);
};
PlayerAPI.getPosition = function() {
    var pos = Entity.getPosition(getPlayerEnt());
    return { x: pos[0], y: pos[1], z: pos[2] };
};
PlayerAPI.addPosition = function(x, y, z) {
    var pos = this.getPosition();
    this.setPosition(pos.x + x, pos.y + y, pos.z + z);
};

PlayerAPI.setVelocity = function(x, y, z) {
    Entity.setVelocity(getPlayerEnt(), x, y, z);
};
PlayerAPI.getVelocity = function() {
    var vel = Entity.getVelocity(getPlayerEnt());
    return { x: vel[0], y: vel[1], z: vel[2] };
};
PlayerAPI.addVelocity = function(x, y, z) {
    var vel = this.getVelocity();
    this.setVelocity(vel.x + x, vel.y + y, vel.z + z);
};

PlayerAPI.experience = function() {
    return {
		get: this.getExperience,
		set: this.setExperience,
		add: this.addExperience
	};
};
PlayerAPI.getExperience = function() {
    return Player.getExp();
};
PlayerAPI.setExperience = function(exp) {
    Player.getExp(exp);
};
PlayerAPI.addExperience = function(exp) {
    Player.addExp(exp);
};

PlayerAPI.level = function() {
    return {
		get: this.getLevel,
		set: this.setLevel,
		add: this.addLevel
	};
};
PlayerAPI.getLevel = function() {
    return Player.getLevel();
};
PlayerAPI.setLevel = function(level) {
    Player.setLevel(level);
};
PlayerAPI.addLevel = function(level) {
    this.setLevel(this.getLevel() + level);
};

PlayerAPI.flying = function() {
    return {
		set: this.setFlying,
		get: this.getFlying,
		getEnabled: this.getFlyingEnabled,
		setEnabled: this.setFlyingEnabled
	};
};
PlayerAPI.getFlyingEnabled = function() {
    return Player.canFly();
};
PlayerAPI.setFlyingEnabled = function(enabled) {
    Player.setCanFly(enabled);
};
PlayerAPI.getFlying = function() {
    return Player.isFlying();
};
PlayerAPI.setFlying = function(enabled) {
    Player.setFlying(enabled);
};

PlayerAPI.exhaustion = function() {
    return {
		get: this.getExhaustion,
		set: this.setExhaustion
	};
};
PlayerAPI.getExhaustion = function() {
    return Player.getExhaustion();
};
PlayerAPI.setExhaustion = function(value) {
    Player.setExhaustion(value);
};

PlayerAPI.hunger = function() {
    return {
		get: this.getHunger,
		set: this.setHunger
	};
};
PlayerAPI.getHunger = function() {
    return Player.getHunger();
};
PlayerAPI.setHunger = function(value) {
    Player.setHunger(value);
};

PlayerAPI.saturation = function() {
    return {
		get: this.getSaturation,
		set: this.setSaturation
	};
};
PlayerAPI.getSaturation = function() {
    return Player.getSaturation();
};
PlayerAPI.setSaturation = function(value) {
    Player.setSaturation(value);
};

PlayerAPI.health = function() {
    return {
		get: this.getHealth,
		set: this.setHealth
	};
};
PlayerAPI.getHealth = function() {
    return Entity.getHealth(getPlayerEnt());
};
PlayerAPI.setHealth = function(value) {
    Entity.setHealth(getPlayerEnt(), value);
};

PlayerAPI.score = function() {
    return {
		get: this.getScore
	};
};
PlayerAPI.getScore = function() {
    return Player.getScore();
};



var ANIMATION_BASE_ENTITY = 10;

var AnimationRegistry = {};
AnimationRegistry.animationList = [];
AnimationRegistry.resetEngine = function() {
    this.animationList = [];
};
AnimationRegistry.registerAnimation = function(anim) {
    this.animationList.push(anim);
};
AnimationRegistry.getEntityArray = function() {
    var entities = [];
    try {
        for (var i in this.animationList) {
            var anim = this.animationList[i];
            if (anim.entity && !anim.remove)
                entities.push(parseInt(anim.entity));
        }
    } catch (e) {
        Logger.Log("animation entities array is damaged (" + entities.length + " entities injected)", "ERROR");
    }
    return { entites: entities };
};

AnimationRegistry.onAttack = function(victim) {
    for (var i in this.animationList) {
        var anim = this.animationList[i];
        if (anim.entity == victim && !anim.remove) {
            preventDefault();
            anim.onAttack();
        }
    }
};

Callback.addCallback("PlayerAttack", function(attacker, victim) {
    AnimationRegistry.onAttack(victim);
});


function AnimationBase(x, y, z) {
    this.render = null;
    Saver.registerObject(this, nonSavesObjectSaver);
    this.setPos = function(x, y, z) {
        this.coords = { x: x, y: y, z: z };
        if (this.render) this.render.setPos(x, y, z);
    };
    this.setInterpolationEnabled = function(enabled) {
        if (this.render) this.render.setInterpolationEnabled(enabled);
    };
    this.setIgnoreBlocklight = function(ignore) {
        if (this.render) this.render.setIgnoreBlocklight(ignore);
    };
    this.setBlockLightPos = function(x, y, z) {
        if (this.render) this.render.setBlockLightPos(x, y, z);
    };
    this.resetBlockLightPos = function() {
        if (this.render) this.render.resetBlockLightPos();
    };
    this.setSkylightMode = function() {
        this.setBlockLightPos(this.coords.x, 256, this.coords.z);
        this.setIgnoreBlocklight(false);
    };
    this.setBlocklightMode = function() {
        this.resetBlockLightPos();
        this.setIgnoreBlocklight(false);
    };
    this.setIgnoreLightMode = function() {
        this.resetBlockLightPos();
        this.setIgnoreBlocklight(true);
    };
    this.setPos(x, y, z);
    this.description = {};
    this.createRenderIfNeeded = function() {
        if (!this.description) return;
        if (!this.render) {
            if (this.description.render)
				this.render = StaticRenderer.createStaticRenderer(this.description.render,
				                                this.coords.x, this.coords.y, this.coords.z);
        }
        if (this.render) {
            if (this.description.skin)
				this.render.setSkin(this.description.skin);
            if (this.description.scale)
				this.render.setScale(this.description.scale);
            if (this.description.render)
				this.render.setRenderer(this.description.render);
        }
    };
    this.isLoaded = false;
    this.updateRender = function() {
        if (this.isLoaded)
			this.createRenderIfNeeded();
        else {
            if (this.render) {
                this.render.remove();
                this.render = null;
            }
        }
    };
    this.load = function() {
        this.remove = false;
        this.isLoaded = true;
        this.updateRender();
    };
    this.loadCustom = function(func) {
        this.load();
        this.update = func;
        Updatable.addUpdatable(this);
    };
    this.getAge = function() {
        return 0;
    };
    this.refresh = function() {
        this.updateRender();
    };
    this.describe = function(description) {
        for (var name in description)
            this.description[name] = description[name];
        this.updateRender();
    };
    this.getRenderAPI = function(base) {
        if (!this.description.renderAPI)
            this.description.renderAPI = new RenderAPI(base);
        return this.description.renderAPI;
    };
    this.destroy = function() {
        this.remove = true;
        this.isLoaded = false;
        this.updateRender();
    };
}


var AnimationItemLoadHelper = {};
AnimationItemLoadHelper.postedAnimations = [];
AnimationItemLoadHelper.postRequired = true;
AnimationItemLoadHelper.onLevelDisplayed = function() {
	this.postRequired = false;
	for (var i in this.postedAnimations) {
		var anim = this.postedAnimations[i];
		if (anim && anim.__postedItem)
			anim.describeItem(anim.__postedItem);
	}
	this.postedAnimations = [];
};

AnimationItemLoadHelper.session = 1;
AnimationItemLoadHelper.onLevelLeft = function() {
	this.postRequired = true;
	this.postedAnimations = [];
	this.session++;
};
AnimationItemLoadHelper.handleItemDescribeRequest = function(anim, item) {
	if (this.postRequired) {
		if (anim.__session != this.session) {
			anim.__session = this.session;
			this.postedAnimations.push(anim);
		}
		anim.__postedItem = item;
		return false;
	} else return true;
};

Callback.addCallback("LevelDisplayed", function() {
    AnimationItemLoadHelper.onLevelDisplayed();
});

Callback.addCallback("LevelLeft", function() {
    AnimationItemLoadHelper.onLevelLeft();
});


var USE_ALTERNATIVE_ITEM_MODEL = false;

function AnimationItem(x, y, z) {
    this.parent = AnimationBase;
    this.parent(x, y, z);
    this.describeItemDefault = function(item) {
        if (!AnimationItemLoadHelper.handleItemDescribeRequest(this, item))
            return;
        if (!item.size) item.size = 0.5;
        var rotation = item.rotation;
        if (!rotation || typeof (rotation) == "string") {
            rotation = [0, 0, 0];
            if (rotation == "x") rotation = [0, 0, Math.PI / 2];
            if (rotation == "z") rotation = [Math.PI / 2, 0, 0];
        }
        var itemModel = Renderer.getItemModel(item.id, item.count, item.data, item.size, rotation[0], rotation[1], rotation[2], !item.notRandomize);
        if (itemModel != null) {
            itemModel.setFinalizeable(false);
            this.describe({ render: itemModel.getRenderType() });
        }
        if (this.lastItemModel && this.lastItemModel != itemModel)
            this.lastItemModel.release();
        this.lastItemModel = itemModel;
        return itemModel;
    };
    this.describeItemAlternative = function(item, offset) {
        if (!item.size) item.size = 0.5;
        var render = new RenderAPI({empty: true});
        var stateName = "__item" + item.id + "|" + item.count + "|" + item.data + "|" + item.size + "|" + item.rotation + "|" + !item.notRandomize;
        if (!offset) offset = { x: 0, y: 0, z: 0 };
		else stateName += "|" + offset.x + "|" + offset.y + "|" + offset.z;
        if (!render.loadState(stateName)) {
            render.createBasicModel();
            var model = [];
            var size = parseInt(item.size * 16);
            var addBox = function(z, rx, ry) {
                model.push({
					type: "box",
					uv: { x: 0, y: 0 },
					size: { x: size, y: size, z: 0 },
					coords: { x: rx + offset.x * 16, y: 25 + ry - offset.y * 16, z: z - offset.z * 16 }
				});
            };
            var fract = Math.min(64, size);
            var width = size / 16;
            for (var z = 0; z < item.count; z++) {
                var randomX = 0, randomY = 0;
                if (z > 0 && !item.notRandomize) {
                    randomX = Math.random() * 5 - 2.5;
                    randomY = Math.random() * 5 - 2.5;
                }
                for (var f = 0; f <= width; f += width / fract)
                    addBox((z - 0.5 - item.count / 2) * width + f, randomX, randomY);
            }
            render.setPart("body", model, {width: size, height: size});
            render.saveState(stateName);
        }
        this.describe({
			renderAPI: render,
			skin: ItemIconSource.getIconName(item.id, item.data)
		});
    };
    this.describeItem = this.describeItemDefault;
    this.tick = function() {};
    
    this.setItemRotation = function(x, y, z) {
        if (this.__postedItem)
            this.__postedItem.rotation = [x, y, z];
        if (this.lastItemModel) {
            var part = this.lastItemModel.getModel().getPart("item");
            if (part) part.setRotation(x, y, z);
        }
    };

    this.setItemSize = function(size) {
        if (this.__postedItem) this.__postedItem.size = [x, y, z];
        if (this.lastItemModel) this.lastItemModel.setScale(size);
    };
    
    this.setItemSizeAndRotation = function(size, x, y, z) {
        this.setItemSize(size);
        this.setItemRotation(x, y, z);
    };

    this._destroy = this.destroy;
    this.destroy = function() {
        this._destroy();
        this.__postedItem = null;
        if (this.lastItemModel)
            this.lastItemModel.release();
    };
}



var __RAD_TO_DEGREES = 180 / Math.PI;

function __radToDegrees(x) {
    return x * __RAD_TO_DEGREES;
}
function __degreesToRad(x) {
    return x / __RAD_TO_DEGREES;
}

// ------------------------------------------------------

function AddonEntity(id, type) {
    this.id = id;
    this.type = type;

    this.getCommandCondition = function() {
        var position = EntityAPI.getPosition(this.id);
        return "@e[x=" + position.x + ",y=" + position.y + ",z=" + position.z + ",r=0.0001]";
    };

    this.exec = function(command) {
        return Commands.exec("execute " + this.getCommandCondition() + " ~ ~ ~ " + command);
    };

    this.execAt = function(command, x, y, z) {
        return Commands.exec("execute " + this.getCommandCondition() + " " + x + " " + y + " " + z + " " + command);
    };
};

var AddonEntityRegistry = {
    data: {},
    awaitCallback: null,
    
    spawn: function(x, y, z, nameID) {
        var result = { entity: null };
        this.awaitCallback = function(entity) {
            result.entity = new AddonEntity(entity, nameID);
            AddonEntityRegistry.data[result.entity] = result.entity;
            return true;
        };
        Commands.exec("summon " + nameID + " " + x + " " + y + " " + z);
        this.awaitCallback = null;
        return result.entity;
    },
    getEntityData: function(entity) {
        return this.data[entity] || null;
    },

    onEntityAdded: function(entity) {
        if (this.awaitCallback && this.awaitCallback(entity))
			this.awaitCallback = null;
    }
};

Callback.addCallback("EntityAdded", function(entity) {
    AddonEntityRegistry.onEntityAdded(entity);
});

// ------------------------------------------------------

var EntityAPI = {};
EntityAPI.getAll = function() {
    return Entity.getAll();
};
EntityAPI.getAllJS = function() {
    return Entity.getAll();
};
EntityAPI.getExtra = function(ent, name) {
	logDeprecation("Entity.getExtra");
	return null;
};
EntityAPI.putExtra = function(ent, name, extra) {
	logDeprecation("Entity.putExtra");
};
EntityAPI.getExtraJson = function(ent, name) {
	// logDeprecation("Entity.getExtraJson");
	// return {};
};
EntityAPI.putExtraJson = function(ent, name, obj) {
	// logDeprecation("Entity.putExtraJson");
};
EntityAPI.addEffect = function(ent, effectId, effectData, effectTime, ambiance, particles) {
    Entity.addEffect(ent, effectId, effectData, effectTime, ambiance, particles);
};
EntityAPI.clearEffect = function(ent, id) {
    Entity.removeEffect(ent, id);
};
EntityAPI.clearEffects = function(ent) {
    Entity.removeAllEffects(ent);
};
EntityAPI.damageEntity = function(ent, damage, cause, params) {
    Entity.dealDamage(ent, damage, cause, params);
};
EntityAPI.healEntity = function(ent, heal) {
    var health = Entity.getHealth(ent) + heal;
    var maxHealth = Entity.getMaxHealth(ent);
    Entity.setHealth(ent, Math.min(health, maxHealth));
};

EntityAPI.getType = function(ent) { 
    return Entity.getEntityTypeId(ent);
};
EntityAPI.getTypeUniversal = function(ent) { 
    var ent = AddonEntityRegistry.getEntityData(ent);
    if (ent != null) return ent.type;
    return Entity.getEntityTypeId(ent);
};
EntityAPI.getTypeAddon = function(ent) { 
    var ent = AddonEntityRegistry.getEntityData(ent);
    if (ent != null) return ent.type;
    return null;
};
EntityAPI.setHitbox = function(ent, w, h) {
    Entity.setCollisionSize(ent, w, h);
};
EntityAPI.isExist = function(entity) {
    return Entity.isValid(entity);
};
EntityAPI.spawn = function(x, y, z, type, skin) {
    if (typeof(type) == "string") {
        var addon = AddonEntityRegistry.spawn(x, y, z, type);
        if (addon != null) return addon.entity;
    }
    return Level.spawnMob(x, y, z, type, skin);
};
EntityAPI.spawnAtCoords = function(coords, type, skin) {
    return this.spawn(coords.x, coords.y, coords.z, type, skin);
};
EntityAPI.spawnCustom = function(name, x, y, z, extra) {
    return this.spawnCustomAtCoords(name, { x: x, y: y, z: z }, extra);
};
EntityAPI.spawnCustomAtCoords = function(name, coords, extra) {
    return MobRegistry.spawnEntityAsPrototype(name, coords, extra);
};
EntityAPI.spawnAddon = function(x, y, z, name) {
    return AddonEntityRegistry.spawn(x, y, z, name);
};
EntityAPI.spawnAddonAtCoords = function(coords, name) {
    return AddonEntityRegistry.spawn(coords.x, coords.y, coords.z, name);
};
EntityAPI.getAddonEntity = function(entity) {
    return AddonEntityRegistry.getEntityData(entity);
};
EntityAPI.remove = function(entity) {
    Entity.remove(entity);
};
EntityAPI.getCustom = function(entity) {
    return MobRegistry.getEntityUpdatable(entity);
};
EntityAPI.getAge = function(ent) {
    return Entity.getAnimalAge(ent);
};
EntityAPI.setAge = function(ent, age) {
    return Entity.setAnimalAge(ent, age);
};
EntityAPI.getSkin = function(ent) {
    return Entity.getMobSkin(ent);
};
EntityAPI.setSkin = function(ent, skin) {
    Entity.setMobSkin(ent, skin);
};
EntityAPI.setTexture = function(ent, texture) {
    this.setSkin(ent, texture.getTexture());
};
EntityAPI.getRender = function(ent) {
    return Entity.getRenderType(ent);
};
EntityAPI.setRender = function(ent, render) {
    Entity.setRenderType(ent, render);
};
EntityAPI.rideAnimal = function(ent1, ent2) {
    Entity.rideAnimal(ent1, ent2);
};
EntityAPI.getNameTag = function(ent) {
    return Entity.getNameTag(ent);
};
EntityAPI.setNameTag = function(ent, tag) {
    return Entity.setNameTag(ent, tag);
};
EntityAPI.getTarget = function(ent) {
    return Entity.getTarget(ent);
};
EntityAPI.setTarget = function(ent, target) {
    return Entity.setTarget(ent, target);
};
EntityAPI.getMobile = function(ent, mobile) {
    Entity.isImmobile(ent);
};
EntityAPI.setMobile = function(ent, mobile) {
    Entity.setImmobile(ent, !mobile);
};
EntityAPI.getSneaking = function(ent) {
    return Entity.isSneaking(ent);
};
EntityAPI.setSneaking = function(ent, sneak) {
    return Entity.setSneaking(ent, sneak);
};
EntityAPI.getRider = function(ent) {
    return Entity.getRider(ent);
};
EntityAPI.getRiding = function(ent) {
    return Entity.getRiding(ent);
};
EntityAPI.setFire = function(ent, fire, force) {
    Entity.setFireTicks(ent, fire || 0, force);
};

EntityAPI.health = function(entity) {
    /* return {
		get: function() {
			return EntityAPI.getHealth(entity);
		},
		set: function(health) {
			EntityAPI.setHealth(entity, health);
		},
		getMax: function() {
			return EntityAPI.getMaxHealth(entity);
		},
		setMax: function(health) {
			EntityAPI.setMaxHealth(entity, health);
		}
	}; */
};
EntityAPI.getHealth = function(ent) {
    return Entity.getHealth(ent);
};
EntityAPI.setHealth = function(ent, health) {
    Entity.setHealth(ent, health);
};
EntityAPI.getMaxHealth = function(ent) {
    return Entity.getMaxHealth(ent);
};
EntityAPI.setMaxHealth = function(ent, health) {
    Entity.setMaxHealth(ent, health);
};

EntityAPI.setPosition = function(ent, x, y, z) {
    Entity.setPosition(ent, x, y, z);
};
EntityAPI.getPosition = function(ent) {
    var pos = Entity.getPosition(ent);
    return { x: pos[0], y: pos[1], z: pos[2] };
};
EntityAPI.addPosition = function(ent, x, y, z) {
    var pos = this.getPosition(ent);
    this.setPosition(ent, pos.x + x, pos.y + y, pos.z + z);
};

EntityAPI.setVelocity = function(ent, x, y, z) {
    Entity.setVelocity(ent, x, y, z);
};
EntityAPI.getVelocity = function(ent) {
    var vel = Entity.getVelocity(ent);
    return { x: vel[0], y: vel[1], z: vel[2] };
};
EntityAPI.addVelocity = function(ent, x, y, z) {
    var vel = this.getVelocity(ent);
    this.setVelocity(ent, vel.x + x, vel.y + y, vel.z + z);
};

EntityAPI.getDistanceBetweenCoords = function(coords1, coords2) {
    return Math.sqrt(Math.pow(coords1.x - coords2.x, 2) + Math.pow(coords1.y - coords2.y, 2) + Math.pow(coords1.z - coords2.z, 2));
};
EntityAPI.getDistanceToCoords = function(ent, coords) {
    return this.getDistanceBetweenCoords(this.getPosition(ent), coords);
};
EntityAPI.getDistanceToEntity = function(ent1, ent2) {
    return this.getDistanceBetweenCoords(this.getPosition(ent1), this.getPosition(ent2));
};
EntityAPI.getXZPlayerDis = function(entity) {
    var dx = getPlayerX() - Entity.getX(entity);
    var dz = getPlayerZ() - Entity.getZ(entity);
    return Math.sqrt(dx * dx + dz * dz);
};
EntityAPI.getLookAngle = function(ent) {
    return {
		pitch: __degreesToRad(-Entity.getPitch(ent)),
		yaw: __degreesToRad(Entity.getYaw(ent))
	};
};
EntityAPI.setLookAngle = function(ent, yaw, pitch) {
    Entity.setRot(ent, __radToDegrees(yaw) || 0, __radToDegrees(-pitch) || 0);
};
EntityAPI.getLookVectorByAngle = function(angle) {
    return {
		x: -Math.sin(angle.yaw) * Math.cos(angle.pitch),
		y: Math.sin(angle.pitch),
		z: Math.cos(angle.yaw) * Math.cos(angle.pitch)
	};
};
EntityAPI.getLookVector = function(ent) {
    var angle = this.getLookAngle(ent);
    return this.getLookVectorByAngle(angle);
};
EntityAPI.getLookAt = function(ent, x, y, z) {
    var position = this.getPosition(ent);
    var delta = { x: x - position.x, y: y - position.y, z: z - position.z };
    delta.size = Math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z);
    delta.x /= delta.size;
    delta.y /= delta.size;
    delta.z /= delta.size;
    var pitch = Math.asin(delta.y);
    var yaw = Math.atan2(-delta.x, delta.z);
    return { yaw: yaw, pitch: pitch };
};
EntityAPI.lookAt = function(ent, x, y, z) {
    var look = this.getLookAt(ent, x, y, z);
    this.setLookAngle(ent, look.yaw, look.pitch);
};
EntityAPI.lookAtCoords = function(ent, coords) {
    this.lookAt(ent, coords.x, coords.y, coords.z);
};
EntityAPI.moveToTarget = function(ent, target, params) {
    var position = this.getPosition(ent);
    var velocity = this.getVelocity(ent);
    var delta = {x: target.x - position.x, y: target.y - position.y, z: target.z - position.z};
    delta.size = Math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z);
    var speed = Math.min(delta.size, params.speed || 0);
    delta.x *= speed / delta.size;
    delta.y *= speed / delta.size;
    delta.z *= speed / delta.size;
    if (params.denyY) {
        delta.y = velocity.y;
        var jump = params.jumpVel || 0;
        if (jump && Math.abs(velocity.y + 0.0781) < 0.001 && (Math.abs(velocity.x) < 0.001 &&
		    Math.abs(delta.x) > 0.1 * speed || Math.abs(velocity.z) < 0.001 && Math.abs(delta.z) > 0.1 * speed))
                delta.y = jump;
    }
    this.setVelocity(ent, delta.x, delta.y, delta.z);
};
EntityAPI.moveToAngle = function(ent, angle, params) {
    speed = (params.speed || 0) + 1;
    var vec = this.getLookVectorByAngle(angle);
    var pos = this.getPosition(ent);
    var target = {
		x: pos.x + vec.x * speed,
		y: pos.y + vec.y * speed,
		z: pos.z + vec.z * speed
	};
    this.moveToTarget(ent, target, params);
};
EntityAPI.moveToLook = function(ent, params) {
    this.moveToAngle(ent, this.getLookAngle(ent), params);
};
EntityAPI.getMovingVector = function(ent) {
    var vel = this.getVelocity(ent);
    vel.size = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    vel.xzsize = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    vel.x /= vel.size;
    vel.y /= vel.size;
    vel.z /= vel.size;
    return vel;
};
EntityAPI.getMovingAngle = function(ent) {
    var vec = this.getMovingVector(ent);
    return {
		pitch: Math.asin(vec.y) || 0,
		yaw: Math.atan2(-vec.x, vec.z) || 0
	};
};
EntityAPI.getMovingAngleByPositions = function(pos1, pos2) {
    logDeprecation("Entity.getMovingAngleByPositions");
};
EntityAPI.findNearest = function(coords, type, maxRange) {
    var data;
    if (type) data = EntityDataRegistry.getDataForType(type);
    else data = EntityDataRegistry.getAllData();
    var closest = { entity: null, dis: 999999999 };
    for (var entity in data) {
        var dis = this.getDistanceToCoords(parseInt(entity), coords);
        if (dis < closest.dis) {
            closest.entity = parseInt(entity);
            closest.dis = dis;
        }
    }
    if (maxRange && closest.dis > maxRange)
        return null;
    return closest.entity;
};
EntityAPI.getAllInRange = function(coords, maxRange, type) {
    var data;
    if (type) data = EntityDataRegistry.getDataForType(type);
    else data = EntityDataRegistry.getAllData();
    var entites = [];
    for (var entity in data) {
        var dis = this.getDistanceToCoords(parseInt(entity), coords);
        if (dis < maxRange) entites.push(parseInt(entity));
    }
    return entites;
};

EntityAPI.getInventory = function(ent, handleNames, handleEnchant) {
    logDeprecation("Entity.getInventory");
};
EntityAPI.getArmorSlot = function(ent, slot) {
    return Entity.getArmorSlot(ent, slot);
};
EntityAPI.setArmorSlot = function(ent, slot, id, count, data, extra) {
    return Entity.setArmorSlot(ent, slot, id, count, data, extra);
};
EntityAPI.getCarriedItem = function(ent, bool1, bool2) {
    return Entity.getCarriedItem(ent);
};
EntityAPI.setCarriedItem = function(ent, id, count, data, extra) {
    return Entity.setCarriedItem(ent, id, count, data, extra);
};
EntityAPI.getOffhandItem = function(ent, bool1, bool2) {
    return Entity.getOffhandItem(ent);
};
EntityAPI.setOffhandItem = function(ent, id, count, data, extra) {
    return Entity.setOffhandItem(ent, id, count, data, extra);
};
EntityAPI.getDroppedItem = function(ent) {
    return Entity.getDroppedItem(ent);
};
EntityAPI.setDroppedItem = function(ent, id, count, data, extra) {
    return Entity.setDroppedItem(ent, id, count, data, extra);
};
EntityAPI.getProjectileItem = function(projectile) {
    return Entity.getProjectileItem(projectile);
};



var CONSTANT_REPLACEABLE_TILES = {
	0: true,
	8: true,
	9: true,
	10: true,
	11: true,
	31: true,
	51: true,
	78: true,
	106: true
};

function canTileBeReplaced(id, data) {
    if(id == 175 && (data % 8 == 2 || data % 8 == 3)) return true;
    return CONSTANT_REPLACEABLE_TILES[id] || false;
}


var CONSTANT_VANILLA_UI_TILES = {
	23: true, // dispenser
	25: true, // note block
	26: true, // bed
	54: true, // chest
	58: true, // workbench
	61: true, 62: true, // furnace
	64: true, // door
	69: true, // lever
	77: true, // stone button
	84: true, // jukebox
	92: true, // cake
	93: true, 94: true, // repeater
	96: true, // wooden trapdoor
	107: true, // fence gate
	116: true, // enchanting table
	117: true, // brewing stand
	122: true, // dragon egg
	125: true, // dropper
	130: true, // ender chest
	138: true, // beacon
	143: true, // wooden button
	145: true, // anvil
	146: true, // trapped chest
	149: true, 150: true, // comparator
	151: true, 178: true, // day light detector
	154: true, // hopper
	183: true, 184: true, 185: true, 186: true, 187: true, // fence gate 2
	193: true, 194: true, 195: true, 196: true, 197: true, // door 2
	205: true, 218: true, // shulker box
	395: true, 396: true, 397: true, 398: true, 399: true, // wooden button 2
	400: true, 401: true, 402: true, 403: true, 404: true, // wooden trapdoor 2
	449: true, // lectern
	450: true, // grindstone
	451: true, 469: true, // blast furnace
	452: true, // stonecutter
	453: true, 454: true, // smoker
	455: true, // cartography table
	458: true, // barrel
	459: true, // loom
	461: true // bell
};

function doesVanillaTileHasUI(id) {
    return !Entity.isSneaking(getPlayerEnt()) && CONSTANT_VANILLA_UI_TILES[id];
}

Callback.addCallback("ItemUse", function(coords, item, block) {
    var placeFunc = BlockRegistry.getPlaceFunc(item.id);
    if (TileEntity.isTileEntityBlock(block.id)) {
        var tileEntity = TileEntity.getTileEntity(coords.x, coords.y, coords.z);
        if (!tileEntity) tileEntity = TileEntity.addTileEntity(coords.x, coords.y, coords.z);
        if (tileEntity && tileEntity.onItemClick(item.id, item.count, item.data, coords)) {
            preventDefault();
            return;
        }
    }
    if (!doesVanillaTileHasUI(block.id)) {
        if (TileEntity.isTileEntityBlock(item.id)) {
            var tile = getTile(coords.relative.x, coords.relative.y, coords.relative.z);
            if (canTileBeReplaced(tile)) {
                if (placeFunc) {
                    var placeCoords = placeFunc(coords, item, block) || coords.relative;
                    TileEntity.addTileEntity(placeCoords.x, placeCoords.y, placeCoords.z);
                } else {
                    setTile(coords.relative.x, coords.relative.y, coords.relative.z, item.id);
                    TileEntity.addTileEntity(coords.relative.x, coords.relative.y, coords.relative.z);
                }
                if (GameAPI.isItemSpendingAllowed()) Player.setCarriedItem(item.id, item.count - 1, item.data);
                WorldAPI.playSound(coords.x, coords.y, coords.z, "dig.stone", 1, 0.8);
                preventDefault();
                return;
            }
        } else {
            if (placeFunc) {
                placeFunc(coords, item, block);
                if (GameAPI.isItemSpendingAllowed()) Player.setCarriedItem(item.id, item.count - 1, item.data);
                WorldAPI.playSound(coords.x, coords.y, coords.z, "dig.stone", 1, 0.8);
                preventDefault();
            }
        }
        ItemRegistry.onItemUsed(coords, item, block);
    }
});



var EntityDataRegistry = {};
EntityDataRegistry.isLevelLoaded = false;

EntityDataRegistry.entityData = {};
EntityDataRegistry.getAllData = function() {
    return this.entityData;
};
EntityDataRegistry.resetEngine = function() {
    this.entityData = {};
    this.entityDataTyped = {};
    this.delayedAddCallbacks = [];
};
EntityDataRegistry.getData = function(entity) {
    return this.entityData[entity] || { type: 0, name: "none" };
};
EntityDataRegistry.getType = function(entity) {
    return this.getData(entity).type;
};

EntityDataRegistry.entityDataTyped = {};
EntityDataRegistry.getDataForType = function(type) {
    if (!this.entityDataTyped[type])
        this.entityDataTyped[type] = {};
    return this.entityDataTyped[type];
};
EntityDataRegistry.entityAdded = function(entity) {
    var type = Entity.getEntityTypeId(entity);
    this.entityData[entity] = { type: type };
    this.getDataForType(type)[entity] = entity;
};
EntityDataRegistry.entityRemoved = function(entity) {
    var type = Entity.getEntityTypeId(entity);
    delete this.entityData[entity];
    delete this.getDataForType(type)[entity];
};

Callback.addCallback("EntityAdded", function(entity) {
    EntityDataRegistry.entityAdded(entity);
});
Callback.addCallback("EntityRemoved", function(entity) {
    EntityDataRegistry.entityRemoved(entity);
});



var ParticleAnimator = {};
ParticleAnimator.addParticle = requireMethodFromNativeAPI("api.NativeAPI", "addParticle");
ParticleAnimator.addFarParticle = requireMethodFromNativeAPI("api.NativeAPI", "addFarParticle");
ParticleAnimator.line = function(particle, coords1, coords2, gap, vel, data) {
    gap = gap || 1;
    var delta = {
		x: coords2.x - coords1.x,
		y: coords2.y - coords1.y,
		z: coords2.z - coords1.z
	};
    vel = vel || { x: 0, y: 0, z: 0 };
    delta.size = Math.sqrt(delta.x * delta.x + delta.y * delta.y + delta.z * delta.z);
    delta.x /= delta.size;
    delta.y /= delta.size;
    delta.z /= delta.size;
    for (var pos = 0; pos < delta.size; pos += Math.random() * gap * 2)
        this.addFarParticle(particle, coords1.x + delta.x * pos, coords1.y + delta.y
		                        * pos, coords1.z + delta.z * pos, vel.x, vel.y, vel.z, data);
};



// ---- DIMENSIONS ----

Dimensions._parsers = {};
Dimensions._parsers.error = function(error, descr) {
	throw new TypeError(error + ": " + JSON.stringify(descr));
};
Dimensions._parsers.getFloat = function(value, default_value) {
	var num = parseFloat(value);
	if (!isNaN(num)) return num;
	return default_value;
};
Dimensions._parsers.getVec3 = function(value, default_value) {
	if (Array.isArray(value))
		return { x: value[0] || 0, y: value[1] || 0, z: value[2] || value[0] || 0 };
	else if (typeof(value) == "object")
		return { x: value.x || value.r || 0, y: value.y || value.g || 0, z: value.z || value.x || value.b || 0 };
	var num = parseFloat(value);
	if (!isNaN(num)) return { x: num, y: num, z: num };
	return default_value;
};

Dimensions._parsers.getMaterialBlockData = function(value, default_value) {
	if (Array.isArray(value))
		return { id: parseInt(value[0]) || 0, data: parseInt(value[1]) || 0, width: parseInt(value[2]) || 1 };
	else if (typeof(value) == "object")
		return { id: parseInt(value.id) || 0, data: parseInt(value.data) || 0, width: parseInt(value.width) || 1 };
	var num = parseInt(value);
	if (!isNaN(num)) return { id: num, data: 0, width: 1 };
	return default_value;
};
Dimensions._parsers.parseTerrainMaterial = function(material, descr) {
	var base = this.getMaterialBlockData(descr.base, { id: 0, data: 0 });
	if (base.id == 0) this.error("TerrainMaterial: base must be defined", descr);
	var cover = this.getMaterialBlockData(descr.cover, { id: 0, data: 0 });
	var surface = this.getMaterialBlockData(descr.surface, { id: 0, data: 0 });
	var filling = this.getMaterialBlockData(descr.filling, { id: 0, data: 0 });
	var diffuse = this.getFloat(descr.diffuse, 0);
	
	material.setBase(base.id, base.data);
	if (cover.id != 0) material.setCover(cover.id, cover.data);
	if (surface.id != 0) material.setSurface(surface.width, surface.id, surface.data);
	if (filling.id != 0) material.setFilling(filling.width, filling.id, filling.data);
	material.setDiffuse(diffuse);
};

Dimensions._parsers.newConversion = function(descr) {
	if (descr == "identity") descr = [[0, 0], [1, 1]];
	else if (descr == "inverse") descr = [[0, 1], [1, 0]];
	var conversion = new Dimensions.NoiseConversion();
	for (var i in descr) {
		var node = this.getVec3(descr[i], { x: 0, y: 0 });
		conversion.addNode(node.x, node.y);
	}
	return conversion;
};
Dimensions._parsers.newNoiseOctave = function(descr) {
	var octave = new Dimensions.NoiseOctave(descr.type || "perlin");
	var scale = this.getVec3(descr.scale, { x: 1, y: 1, z: 1 });
	var translate = this.getVec3(descr.scale, { x: 0, y: 0, z: 0 });
	var weight = this.getFloat(descr.weight, 1);
	var seed = this.getFloat(descr.seed, 0);
	if (descr.conversion) octave.setConversion(this.newConversion(descr.conversion));
	return octave.setScale(scale.x, scale.y, scale.z).setTranslate(translate.x, translate.y, translate.z).setWeight(weight).setSeed(seed);
};
Dimensions._parsers.newNoiseLayer = function(descr) {
	if (descr.octaves) {
		var layer = new Dimensions.NoiseLayer();
		if (Array.isArray(descr.octaves))
			for (var i in descr.octaves)
			    layer.addOctave(this.newNoiseOctave(descr.octaves[i]));
		else {
			var count = this.getFloat(descr.octaves.count);
			if (count <= 0) this.error("NoiseLayer: octave count is missing or invalid", descr);
			var seed = this.getFloat(descr.octaves.seed, 0);
			var weight = this.getFloat(descr.octaves.weight, 1);
			var weight_factor = this.getFloat(descr.octaves.weight_factor, 2);
			var scale_factor = this.getVec3(descr.octaves.scale_factor, { x: 2, y: 2, z: 2 });
			var default_scale = 1 << count;
			var scale = this.getVec3(descr.octaves.scale, {
				x: default_scale, y: default_scale, z: default_scale
			});
			var mul = 2 * ((1 << count) - 1) / (1 << count);
			for (var i = 0; i < count; i++) {
				layer.addOctave(this.newNoiseOctave({
					scale: { x: 1 / scale.x, y: 1 / scale.y, z: 1 / scale.z },
					weight: weight / mul, seed: seed + i
				}));
				scale.x /= scale_factor.x;
				scale.y /= scale_factor.y;
				scale.z /= scale_factor.z;
				mul *= weight_factor;
			}
		}
		if (descr.conversion) layer.setConversion(this.newConversion(descr.conversion));
		return layer;
	} else {
		var octave = this.newNoiseOctave(descr);
		var layer = new Dimensions.NoiseLayer();
		layer.addOctave(octave);
		return layer;
	}
};
Dimensions._parsers.newNoiseGenerator = function(descr) {
	if (descr.layers) {
		var generator = new Dimensions.NoiseGenerator();
		for (var i in descr.layers) generator.addLayer(this.newNoiseLayer(descr.layers[i]));
		if (descr.conversion) generator.setConversion(this.newConversion(descr.conversion));
		return generator;
	} else {
		var layer = this.newNoiseLayer(descr);
		var generator = new Dimensions.NoiseGenerator();
		generator.addLayer(layer);
		return generator;
	}
};
Dimensions._parsers.newTerrainLayer = function(descr, factory) {
	var minY = this.getFloat(descr.minY, -1);
	var maxY = this.getFloat(descr.maxY, -1);
	if (minY == -1 || maxY == -1) this.error("TerrainLayer: no minY or maxY specified", descr);
	minY = parseInt(minY);
	maxY = parseInt(maxY);
	if (minY < 0 || maxY > 256 || minY >= maxY) this.error("TerrainLayer: invalid range " + minY + " " + maxY, descr);
	var layer = factory(minY, maxY);
	if (descr.noise) layer.setMainNoise(this.newNoiseGenerator(descr.noise));
	if (descr.heightmap) layer.setHeightmapNoise(this.newNoiseGenerator(descr.heightmap));
	if (descr.yConversion) layer.setYConversion(this.newConversion(descr.yConversion));
	this.parseTerrainMaterial(layer.getMainMaterial(), descr.material);
	if (descr.materials)
		for (var i in descr.materials) {
			var material = descr.materials[i];
			if (!material.noise) this.error("TerrainLayer: material missing noise", material);
			this.parseTerrainMaterial(layer.addNewMaterial(this.newNoiseGenerator(material.noise), 0), material);
		}
	return layer;
};
Dimensions._parsers.newTerrainLayerSet = function(descr, factory) {
	var layers = descr.layers;
	if (layers) {
		var result = [];
		for (var i in layers)
		    result.push(this.newTerrainLayer(layers[i], factory));
		return result;
	} else this.error("field 'layers' not found in layer set description", descr);
};
Dimensions._parsers.newMonoBiomeTerrainGenerator = function(descr) {
	var generator = new Dimensions.MonoBiomeTerrainGenerator();
	this.newTerrainLayerSet(descr, function(minY, maxY) {
		return generator.addTerrainLayer(minY, maxY);
	});
	if (descr.biome) generator.setBaseBiome(this.getFloat(descr.biome));
	return generator;
};
Dimensions._parsers.newGenerator = function(descr) {
	var generator = new Dimensions.CustomGenerator(descr.base || "overworld");
	if (descr.buildVanillaSurfaces != undefined)
		generator.setBuildVanillaSurfaces(descr.buildVanillaSurfaces);
	if (descr.generateVanillaStructures != undefined)
		generator.setGenerateVanillaStructures(descr.generateVanillaStructures);
	if (descr.modWorldgenDimension != undefined) {
		var dimensionMap = {
			overworld: 0,
			nether: 1,
			end: 2
		};
		var id = descr.modWorldgenDimension;
		if (id in dimensionMap) id = dimensionMap[id];
		generator.setModGenerationBaseDimension(id);
	}
	descr.type = descr.type || "mono";
	switch(descr.type) {
		case "mono":
			generator.setTerrainGenerator(this.newMonoBiomeTerrainGenerator(descr));
			return generator;
	}
	this.error("invalid generator type: " + descr.type, descr);
};

Dimensions.newGenerator = function(description) {
    return Dimensions._parsers.newGenerator(description);
};


// --------------------

var Resources = {};
Resources.addRuntimePack = function(type, name) {
	return MCSystem.addRuntimePack(type, name);
};

// --------------------

Translation.addTranslation("Workbench", { ru: "Верстак" });
Translation.addTranslation("off", { ru: "Выкл" });
Translation.addTranslation("on", { ru: "Вкл" });
Translation.addTranslation("yes", { ru: "Да" });
Translation.addTranslation("no", { ru: "Нет" });
Translation.addTranslation("mb", { ru: "мВ" });
Translation.addTranslation("system.thread_stopped", {
	en: "All mods are stopped because of\nfatal error on main thread.\nPlease re-enter the world.",
	ru: "Работа модов приостановлена из-за ошибки,\nперезайдите в мир."
});

var CoreAPI = {};
CoreAPI.getCoreAPILevel = function() {
    return CORE_ENGINE_API_LEVEL;
};
CoreAPI.runOnMainThread = function(func) {
    MCSystem.runOnMainThread({ run: func });
};
CoreAPI.getMCPEVersion = function() {
    var version = { str: MCSystem.getMinecraftVersion() + "" };
    version.array = version.str.split(".");
    for (var i in version.array)
        version.array[i] = parseInt(version.array[i]) || 0;
    version.main = version.array[1] + version.array[0] * 17;
    return version;
};

CoreAPI.Debug = {};
CoreAPI.Debug.sysTime = function() {
    return java.lang.System.currentTimeMillis();
};
CoreAPI.Debug.addParticle = function(id, x, y, z, vx, vy, vz, data) {
    Level.addParticle(id, x, y, z, vx, vy, vz, data);
};
CoreAPI.Debug.message = function(message) {
    clientMessage(ChatColor.GREEN + "DEBUG: " + new String(message));
};
CoreAPI.Debug.warning = function(message) {
    clientMessage(ChatColor.GOLD + "WARNING: " + new String(message));
};
CoreAPI.Debug.error = function(message) {
    clientMessage(ChatColor.RED + "ERROR: " + new String(message));
};
CoreAPI.Debug.m = function() {
    var messages = [];
    for (var i in arguments) {
        var obj = arguments[i];
        if (typeof (obj) == "object")
            messages.push(JSON.stringify(obj));
        else messages.push("" + obj);
    }
    this.message(messages.join(", "));
};
CoreAPI.Debug.bitmap = function(bitmap, title) {
    GuiUtils.Run(function() {
        var ctx = getMcContext();
        var builder = android.app.AlertDialog.Builder(ctx);
        if (title) builder.setTitle(title + "");
        var imgView = new android.widget.ImageView(ctx);
        imgView.setImageBitmap(bitmap);
        builder.setView(imgView);
        builder.show();
    });
};

CoreAPI.FileTools = FileTools;
CoreAPI.Threading = Threading;
CoreAPI.Logger = Logger;
CoreAPI.Translation = Translation;
CoreAPI.Resources = Resources;

CoreAPI.UpdatableAPI = CoreAPI.Updatable = Updatable;
CoreAPI.Config = Config;
CoreAPI.UI = UI;
CoreAPI.TileEntity = TileEntity;
CoreAPI.Callback = Callback;
CoreAPI.GameObject = GameObject;
CoreAPI.GameObjectRegistry = GameObjectRegistry;

CoreAPI.Dimensions = Dimensions;
CoreAPI.CustomBiome = CustomBiome;
CoreAPI.Commands = Commands;

CoreAPI.Entity = EntityAPI;
CoreAPI.Player = PlayerAPI;
CoreAPI.ModAPI = ModAPI;
CoreAPI.Saver = SaverAPI;
CoreAPI.World = WorldAPI;
CoreAPI.Game = GameAPI;

CoreAPI.AddonEntityRegistry = AddonEntityRegistry;
CoreAPI.MobRegistry = MobRegistry;
CoreAPI.MobSpawnRegistry = EntitySpawnRegistry;

CoreAPI.Render = RenderAPI;
CoreAPI.Texture = Texture;
CoreAPI.EntityModel = ModelAPI;
CoreAPI.EntityModelWatcher = ModelWatcher;
CoreAPI.EntityAIClass = EntityAI;
CoreAPI.EntityAIWatcher = EntityAIWatcher;
CoreAPI.EntityAI = {};
CoreAPI.EntityAI.Idle = EntityAIIdle;
CoreAPI.EntityAI.Follow = EntityAIFollow;
CoreAPI.EntityAI.Panic = EntityAIPanic;
CoreAPI.EntityAI.Wander = EntityAIWander;
CoreAPI.EntityAI.Attack = EntityAIAttack;
CoreAPI.EntityAI.Swim = EntityAISwim;
CoreAPI.EntityAI.PanicWatcher = EntityAIPanicWatcher;

CoreAPI.GenerationUtils = WorldGenerationUtils;
CoreAPI.Animation = {};
CoreAPI.Animation.Base = CoreAPI.Animation.base = AnimationBase;
CoreAPI.Animation.Item = CoreAPI.Animation.item = AnimationItem;

CoreAPI.Particles = ParticleAnimator;

CoreAPI.IDRegistry = IDRegistry;
CoreAPI.IDData = {};
CoreAPI.IDData.item = CoreAPI.ItemID = ItemID;
CoreAPI.IDData.block = CoreAPI.BlockID = BlockID;

CoreAPI.Block = BlockRegistry;
CoreAPI.Item = ItemRegistry;
CoreAPI.Armor = ArmorRegistry;
/* CoreAPI.Liquid = */ CoreAPI.LiquidRegistry = LiquidRegistry;
CoreAPI.BlockRenderer = BlockRenderer;
CoreAPI.ICRender = ICRender;
CoreAPI.Recipes = Recipes;
CoreAPI.ToolAPI = ToolAPI;

CoreAPI.Native = {};
CoreAPI.Native.ArmorType = ArmorType;
CoreAPI.Native.ItemCategory = ItemCategory;
CoreAPI.Native.ParticleType = ParticleType;
/* CoreAPI.Native.ChatColor = */ CoreAPI.Native.Color = ChatColor;
CoreAPI.Native.EntityType = EntityType;
CoreAPI.Native.MobRenderType = EntityRenderType;
CoreAPI.Native.PotionEffect = MobEffect;
CoreAPI.Native.Dimension = DimensionId;
CoreAPI.Native.ItemAnimation = UseAnimation;
CoreAPI.Native.BlockSide = BlockFace;
CoreAPI.Native.Enchantment = Enchantment;
CoreAPI.Native.EnchantType = EnchantType;
CoreAPI.Native.BlockRenderLayer = BlockRenderLayer;
CoreAPI.Native.GameMode = GameMode;
CoreAPI.Native.GameDifficulty = GameDifficulty;

CoreAPI.alert /* = CoreAPI.print */ = print;

function ResetInGameAPIs() {
    TileEntity.resetEngine();
    ToolAPI.resetEngine();
    EntityDataRegistry.resetEngine();
    WorldGeneration.resetEngine();
    GameObjectRegistry.resetEngine();
}

Callback.addCallback("LevelLeft", function() {
    ResetInGameAPIs();
});

function injectCoreAPI(scope) {
    for (var name in CoreAPI) scope[name] = CoreAPI[name];
}

Callback.addCallback("NativeCommand", function(commandString) {
    var command = commandString.split(" ");
    if (command.shift() == "c") {
        if (command[0] == "gm") {
            var gm = parseInt(command[1]);
            Level.setGameMode(gm);
        }
        if (command[0] == "give") {
            var item = parseInt(command[1]) || 0;
            var count = parseInt(command[1]) || 64;
            var data = parseInt(command[1]) || 0;
            Player.addItemInventory(item, count, data);
        }
    }
});
